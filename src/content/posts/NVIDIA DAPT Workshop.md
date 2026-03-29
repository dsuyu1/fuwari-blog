---
title: "Domain-Adaptive Pre-Training: Tailoring LLMs for Specialized Applications"
published: 2026-3-28T00:00:00-08:00
description: This blog post is a review of what I learned in NVIDIA's DAPT workshop, along with some notes and code review.
tags: [NVIDIA, DAPT, AI, Python]
category: Artificial Intelligence
draft: true
---

# Introduction
My university has given me the privilege to access NVIDIA's catalog of hands-on workshops for free! In this blog post, I'll be walking through _Domain-Adaptive Pre-Training: Tailoring LLMs for Specialized Applications_. If you'd like to learn more about Domain-Adaptive Pre-Training (DAPT), please read on! 

Domain-Adaptive Pre-Training (DAPT) is the process of futher traininig pre-trained general LLMs on domain-specific data. For example, we might train an LLM on curated cybersecurity data to make it better at answer cyber-specific questions.

In this workshop, I'll be diving into how to perform DAPT using NVIDIA's toolkit.

# 1. Data Curation
In this first part of the workshop, we need to curate data from different data sources to prepare for LLM training. 

## Troubleshooting
When running the non-demo version of the DAPT Curation Jupyter Notebook, I ran into a lot of issues. I assume the majority were the result of dated code. Regardless, I tried my best to fix as many issues as I could so we could see how all the components of the full version worked, rather than just the demo. The demo does not include the blending/shuffling step, nor does it redact PII or deduplication.
Here are some issues that you might run into:

> A module that was compiled using NumPy 1.x cannot be run in NumPy 2.2.6 as it may crash. To support both 1.x and 2.x versions of NumPy, modules must be compiled with NumPy 2.0.

To fix this, I downgraded NumPy using this command: 

`pip install "numpy<2" --break-system-packages`. 

Also, arxiv will probably rate limit you when you try downloading all the files in the workshop. You can avoid this by adding delays between requests. You'll have to be patient! I had no issue when it came to rate limiting with GitHub or Wikipedia. 

The reason why you get rate limited is because the workshop uses 8 [Dask workers](https://docs.dask.org/en/stable/) to pull articles at the same time. 

Also, you may run into issues with Wikipedia giving you 403 errors. This is because Wikipedia doesn't like it when you don't add a User-Agent header to your requests. For example: 

```py
url = 'https://en.wikipedia.org/wiki/PowerPC'
response = requests.get(url)
print('Status:', response.status_code)
print('Content type:', response.headers.get('content-type'))
print('First 500 bytes:', response.content[:500])
"
```

The response:

```
Status: 403
Content type: text/plain
First 500 bytes: b'Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.\n'
```

You may have to reduce the number of workers. 8 workers each loading spaCy's large model simultaneously was too much for my potato of a machine. I reduced it to two so that it wouldn't crash and the program could move on to the curation pipeline. 8 workers was nice for downloading all the sources. I would get up and do chores in between runs, haha.

Here's what I did to solve the rate limiting problem:

```bash
root@c18921b74f46:/dli/task/01_data_curation/dapt-curation-demo# python3 -c "
content = open('/dli/task/01_data_curation/dapt-curation-demo/docbuilder.py').read()
old = '        if article := next(search_result):\n            print(f\'Downloading arXiv article \"{url}\"...\')\n            pdf_path = article.download_pdf(\n                dirpath=self.pdf_root_dir, filename=pdf_name\n            )\n        else:\n            print(f\"Failed to download article \'{url}\'.\")\n            return None'
new = '        try:\n            article = next(search_result, None)\n            if article:\n                print(f\'Downloading arXiv article \"{url}\"...\')\n                pdf_path = article.download_pdf(dirpath=self.pdf_root_dir, filename=pdf_name)\n            else:\n                print(f\"Failed to download article \'{url}\'.\")\n                return None\n        except Exception as e:\n            print(f\"Skipping \'{url}\': {e}\")\n            return None'
result = content.replace(old, new, 1)
if result == content:
    print('ERROR: string not found')
else:
    open('/dli/task/01_data_curation/dapt-curation-demo/docbuilder.py', 'w').write(result)
    print('Done')
"
Done
```

## 1.1 Reviewing the Data Curation Pipeline

If everything is running as it should, you should see something like this in the terminal:

```
Original dataset length for text files: 10
After dataprep for text files: 10
Original dataset length for code files: 13864
After dataprep length for code files: 13852
Writing the results to disk...
Writing to disk complete for 10 partition(s)
Writing to disk complete for 2 partition(s)
Writing results to disk completed
Split dataset by metadata
Data Curation completed
```

![The finished curation pipeline output](/data_curation.png)

## 1.2 Workflow
We downloaded raw data from three sources: Wikipedia (text), GitHub repositories (code), and arXiv PDFs. These represent the domain-specific knowledge you'd use to fine-tune a language model. 

```py
    wikipedia_dir = download_wikipedia_sources(
        "sources/wikipedia_urls.jsonl", limit=wikipedia_limit
    )
    github_dir = download_github_sources(
        "sources/github_repos.jsonl", limit=github_limit
    )
    pdf_dir = download_pdf_sources("sources/arxiv_urls.jsonl", limit=pdf_limit)
```

Each downloader fetches raw content and writes it to disk as a  `.jsonl` file that NeMo Curator can read.

### 1.21 Curation Pipeline
The raw data was then run through the **curation pipeline**. This included cleaning and unifying the formatting (like fixing unicode issues), filtering by line count to remove trivially short documents, exact deduplication to remove identical document, and PII redaction on code files.
The PII redaction was done with the[spaCy](https://spacy.io/) and [Presidio](https://microsoft.github.io/presidio/) recognizers. We stripped emails, phone numbers, SSNs, etc.

Two separate pipelines are defined, one for text, and one for code.

```py
    curation_steps_text = Sequential(
        [
            clean_and_unify,
            ScoreFilter(
                TextLineCountFilter(), text_field="file_type_count", score_type=bool
            ),
            filter_text,
        ]
    )

    # Define data curation steps for code files
    curation_steps_code = Sequential(
        [
            clean_and_unify,
            ScoreFilter(
                CodeLineCountFilter(), text_field="file_type_count", score_type=bool
            ),
            filter_code,
        ]
    )
```
We also split the results by category. This is so they can be blended at different weights for pre-training.

```py
    # Split the dataset by file category and save curated files (optional - to create blended datasets)
    print("Split dataset by metadata")
    separated_data_text = separate_by_metadata(
        final_dataset_text.df, out_path, "category"
    ).compute()
    separated_data_code = separate_by_metadata(
        final_dataset_code.df, out_path, "category"
    ).compute()

    client.close()
```

### 1.22 Blending and Shuffling
Lastly, we blended and shuffled the data.

```py
def blend_and_shuffle(
    args: Any, dataset_paths: list, dataset_weights: list, target_size: int
) -> None:
    """
    Blend and shuffle curated data based on file paths for continued pre-training

    Args:
        args (Any): Command-line arguments.
        dataset_paths (list): List containing directory paths where the different JSONL files are stored.
        dataset_weights (list): List setting weights for each directory path
        target_size (int): Target number of data samples after blending
    """
    root_path = os.path.join(DATA_DIR, "curated")
    output_path = root_path + "/data_blended"
    if os.path.isdir(output_path):
        shutil.rmtree(output_path)
    os.makedirs(output_path)

    # Blend the datasets
    datasets = [DocumentDataset.read_json(path) for path in dataset_paths]
    blended_dataset = nc.blend_datasets(target_size, datasets, dataset_weights)

    shuffle = nc.Shuffle(seed=42)
    blended_dataset = shuffle(blended_dataset)

    # Save the blend
    blended_dataset.to_json(output_path)
```

**Blending** is about controlling the mix of data types your model trains on, because we usually don't want raw proportions. In our case, our weights were:

```py
dataset_paths = [
    root_path + "/CPP",
    root_path + "/VerilogVHDL",
    root_path + "/text",
    root_path + "/Python",
]
dataset_weights = [1.0, 4.0, 4.0, 1.0]
target_size = 20
```
VerilogVHDL and text both get weight 4.0 while CPP and Python get 1.0. This means the blender will sample 4x more Verilog and Wikipedia text relative to C++ and Python when building the final training set. The reason we'd do this is that a model whose whole point, in this case, is for chip design, we'd want to make it better at technical language/docmentation, so we deliberatly oversample those even they're rarer in the raw data.

Shuffling happens after blending:

```py
shuffle = nc.Shuffle(seed=42)
blended_dataset = shuffle(blended_dataset)
``` 
Without shuffling, the blended dataset would be grouped by source:
- All the Verilog documents would be together.
- All the text together, etc.

If you train on the data sequentially, the model experiences what's called catestrophic forgetting. It learns Verilog well, then overwirtes those weihts learning text, then overwrites again on Pythn. Shuffling interleaves everything so each trainig batch contains a random mix of all categories, which leads to more stable gradient updates and better retention across all domains.

### 1.23 Results
Looking at the results, we can see that all 10 text documents passed the quality filters (none were dropped). However, for the code, we had 13,864 documents in, and 13,852 out; 12 documents were dropped as duplicates or were too short. 

The curated data was written to /data/curated/ and then split by category so it ca

# 2. Custom Tokenization

![Tokenization diagram](/data_tokenization.png)