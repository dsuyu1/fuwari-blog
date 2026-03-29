---
title: "Domain-Adaptive Pre-Training: Tailoring LLMs for Specialized Applications"
published: 2026-3-28T00:00:00-08:00
description: This blog post is a review of what I learned in NVIDIA's DAPT workshop, along with some notes and code review.
tags: [NVIDIA, DAPT, AI, Python]
category: Artificial Intelligence
image: https://cdn.marutitech.com/Artboard_2_copy_2x_2b6b1eae5f.png
draft: false
---

# Introduction

My university gave me the privilege of accessing NVIDIA's catalog of hands-on workshops for free. In this blog post, I cover _Domain-Adaptive Pre-Training: Tailoring LLMs for Specialized Applications_. If you'd like to learn more about Domain-Adaptive Pre-Training (DAPT), please read on!

[Domain-Adaptive Pre-Training (DAPT)](https://marutitech.com/domain-adaptive-pretraining-llms/) is the process of further training pre-trained general LLMs on domain-specific data. For example, we might train an LLM on curated cybersecurity data to make it better at answering cyber-specific questions.

In this workshop, I dive into how to perform DAPT using NVIDIA's toolkit.

If you're curious, here are the dependencies for the notebook:

```bash frame="code" title="Install dependencies"
apt update
apt-get install poppler-utils
apt-get install tesseract-ocr
apt install libtesseract-dev
pip install -r requirements.txt
pip uninstall --yes $(pip list --format=freeze | grep opencv)
rm -rf /usr/local/lib/python3.10/dist-packages/cv2/
pip install opencv-python-headless
pip install -r requirements.txt
python -c "import nltk; nltk.download('punkt_tab')"
python -c "import nltk; nltk.download('averaged_perceptron_tagger_eng')"
```


# 1. Data Curation

The tutorial follows the steps below:

1. Install requirements and import libraries
2. Download the data from online sources (Github repos, wiki urls, arxiv pdfs), extract metadata and convert to JSONL
3. Load the dataset 
4. Examine the file types and sizes (optional) 
5. Run the data curation pipeline with with Nemo Curator
    - File type identification and separation
    - Document-level exact deduplication
    - Heuristic-based quality filtering (Number of lines, worc count, top N-grams, etc.)
    - Fix unicode errors via ftfy
    - PII redaction
    - GPU accelerated fuzzy and semantic deduplication
6. Save the filtered and curated data 
7. Blend datasets and shuffle

In the first part of the workshop, we curate data from different sources to prepare it for LLM training. I used NeMo Curator, NVIDIA's open-source library for scalable data curation, built on top of Dask for distributed computing.

:::note
**Dask** parallelizes the pipeline across multiple workers, so instead of processing one document at a time, you can process partitions of documents simultaneously.
::: 

## Troubleshooting

When running the non-demo version of the DAPT Curation Jupyter Notebook, I encountered numerous issues, mostly due to outdated code. I fixed as many problems as possible so we could observe the full workflow instead of just the demo. The demo skips blending/shuffling and does not perform PII redaction or deduplication.

### Common issues

- `NumPy` compatibility: modules compiled with NumPy 1.x may fail on NumPy 2.2.6. To support both versions, recompile or use NumPy 2.0.

```bash
pip install "numpy<2" --break-system-packages
```

- Rate limits from arXiv when downloading many files. Add delays and reduce concurrency if needed.
- Wikipedia may return 403 unless a User-Agent header is included.

```bash
url = 'https://en.wikipedia.org/wiki/PowerPC'
response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
print('Status:', response.status_code)
print('Content type:', response.headers.get('content-type'))
print('First 500 bytes:', response.content[:500])
```

Typical 403 message:

```bash frame="code" title="Wikipedia 403 response"
Status: 403
Content type: text/plain
First 500 bytes: b'Please set a user-agent and respect our robot policy https://w.wiki/4wJS. See also https://phabricator.wikimedia.org/T400119.\n'
```

The workshop used 8 [Dask workers](https://docs.dask.org/en/stable/) to fetch articles concurrently. This may overwhelm your machine, especially while loading spaCy models. I reduced workers to two for stability.

### Example patch

<details>
<summary>Show patch</summary>

```bash 
cat > /tmp/fix_all.py << 'ENDOFSCRIPT'
# ============================================================
# DAPT Workshop - Comprehensive Fix Script
# Fixes compatibility issues in dapt-curation/docbuilder.py
# and NeMo-Curator's doc_builder.py
# ============================================================

import sys

TARGET = '/dli/task/01_data_curation/dapt-curation/docbuilder.py'
NEMO   = '/opt/NeMo-Curator/nemo_curator/download/doc_builder.py'

# ── Fix 1: User-Agent header for Wikipedia ──────────────────
lines = open(TARGET).readlines()
for i, line in enumerate(lines):
    if 'response = requests.get(url)' in line and 'headers' not in line:
        lines[i] = (
            '        headers = {"User-Agent": "Mozilla/5.0 (compatible; DAPTWorkshop/1.0)"}\n'
            '        response = requests.get(url, headers=headers)\n'
        )
        print("Fix 1 done: User-Agent header")
        break
else:
    print("Fix 1 already present")
open(TARGET, 'w').writelines(lines)

# ── Fix 2: #firstHeading guard ──────────────────────────────
lines = open(TARGET).readlines()
for i, line in enumerate(lines):
    if 'html.select("#firstHeading")[0].text' in line:
        lines[i] = (
            '        headings = html.select("#firstHeading")\n'
            '        if not headings:\n'
            '            return None\n'
            '        title = headings[0].text\n'
        )
        print("Fix 2 done: #firstHeading guard")
        break
else:
    print("Fix 2 already present")
open(TARGET, 'w').writelines(lines)

# ── Fix 3: WikitxtIterator.iterate None guard ───────────────
lines = open(TARGET).readlines()
for i, line in enumerate(lines):
    if 'def iterate(self, file_path):' in line and i < 130:
        if 'if not file_path' not in lines[i+1]:
            lines.insert(i+1, '        if not file_path:\n')
            lines.insert(i+2, '            return\n')
            open(TARGET, 'w').writelines(lines)
            print("Fix 3 done: iterate None guard")
        else:
            print("Fix 3 already present")
        break

# ── Fix 4: arXiv 429 graceful skip ─────────────────────────
content = open(TARGET).read()
if 'except Exception as e:' not in content:
    old = (
        '        if article := next(search_result):\n'
        '            print(f\'Downloading arXiv article "{url}"...\')\n'
        '            pdf_path = article.download_pdf(\n'
        '                dirpath=self.pdf_root_dir, filename=pdf_name\n'
        '            )\n'
        '        else:\n'
        '            print(f"Failed to download article \'{url}\'.")\n'
        '            return None'
    )
    new = (
        '        try:\n'
        '            article = next(search_result, None)\n'
        '            if article:\n'
        '                print(f\'Downloading arXiv article "{url}"...\')\n'
        '                pdf_path = article.download_pdf(dirpath=self.pdf_root_dir, filename=pdf_name)\n'
        '            else:\n'
        '                print(f"Failed to download article \'{url}\'.")\n'
        '                return None\n'
        '        except Exception as e:\n'
        '            print(f"Skipping \'{url}\': {e}")\n'
        '            return None'
    )
    result = content.replace(old, new, 1)
    if result == content:
        print("Fix 4 ERROR: arXiv string not found - may need manual patch")
    else:
        open(TARGET, 'w').write(result)
        print("Fix 4 done: arXiv 429 graceful skip")
else:
    print("Fix 4 already present")

# ── Fix 5: NeMo-Curator os.remove(None) guard ──────────────
content = open(NEMO).read()
if 'if downloaded_file:' not in content:
    old = '    if not keep_raw_download:\n        os.remove(downloaded_file)'
    new = '    if not keep_raw_download:\n        if downloaded_file:\n            os.remove(downloaded_file)'
    result = content.replace(old, new, 1)
    if result == content:
        print("Fix 5 ERROR: string not found in doc_builder.py")
    else:
        open(NEMO, 'w').write(result)
        print("Fix 5 done: os.remove None guard")
else:
    print("Fix 5 already present")

# ── Verification ────────────────────────────────────────────
print("\n── Verification ──────────────────────────────────────")
checks = [
    (TARGET, 'User-Agent',       "User-Agent header"),
    (TARGET, 'if not headings',  "#firstHeading guard"),
    (TARGET, 'if not file_path', "iterate None guard"),
    (TARGET, 'except Exception', "arXiv 429 skip"),
    (NEMO,   'if downloaded_file', "os.remove guard"),
]
all_good = True
for path, pattern, label in checks:
    found = pattern in open(path).read()
    status = "✓" if found else "✗ MISSING"
    print(f"  {status}  {label}")
    if not found:
        all_good = False

print()
if all_good:
    print("All fixes verified. Run: pip install 'numpy<2' --break-system-packages && python main.py")
else:
    print("Some fixes are missing — check errors above.")
ENDOFSCRIPT
python3 /tmp/fix_all.py
```

</details>

## 1.1 Reviewing the Data Curation Pipeline

Expected terminal output:

```bash
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

Raw data sources:

- Wikipedia (text)
- GitHub repositories (code)
- arXiv PDFs

```py frame="code" title="Download curated sources"
wikipedia_dir = download_wikipedia_sources(
    "sources/wikipedia_urls.jsonl", limit=wikipedia_limit
)
github_dir = download_github_sources(
    "sources/github_repos.jsonl", limit=github_limit
)
pdf_dir = download_pdf_sources("sources/arxiv_urls.jsonl", limit=pdf_limit)
```
:::note
We save the content to `.jsonl` files (JSON Lines). Each line in a `.jsonl` file is a complete JSON object, which makes it easier to read in parallel with Dask, where each worker can read its own chunk of lines independently.
:::

Each downloader writes raw content to a `.jsonl` file for [NeMo Curator](https://docs.nvidia.com/nemo/curator/latest/about/index.html#about-overview).



### 1.21 Curation Pipeline

The raw data is processed through the **curation pipeline**:
- clean and unify formatting (e.g., Unicode normalization)
- line-count filtering to remove too-short documents
- exact deduplication to remove identical documents
- PII redaction on code files using spaCy and Presidio recognizers

Separate pipelines are defined for text and code.

```py frame="code" title="Two Pipelines"
curation_steps_text = Sequential(
    [
        clean_and_unify,
        ScoreFilter(
            TextLineCountFilter(), text_field="file_type_count", score_type=bool
        ),
        filter_text,
    ]
)

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

Then data is split by category so it can be blended at different weights.

```py frame="code" title="Split by category"
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

Finally, we blend and shuffle.

```py frame="code" title="Blend and shuffle function"
def blend_and_shuffle(
    args: Any, dataset_paths: list, dataset_weights: list, target_size: int
) -> None:
    """Blend and shuffle curated data based on file paths for continued pre-training."""
    root_path = os.path.join(DATA_DIR, "curated")
    output_path = root_path + "/data_blended"
    if os.path.isdir(output_path):
        shutil.rmtree(output_path)
    os.makedirs(output_path)

    datasets = [DocumentDataset.read_json(path) for path in dataset_paths]
    blended_dataset = nc.blend_datasets(target_size, datasets, dataset_weights)

    shuffle = nc.Shuffle(seed=42)
    blended_dataset = shuffle(blended_dataset)

    blended_dataset.to_json(output_path)
```
<div align="center">

![Blender](/blender.jpg)

<small>

**Blending** controls the training mix rather than using raw source proportions. 

</small>
</div>
Blending weights:

```py frame="code" title="Blending weight config"
dataset_paths = [
    root_path + "/CPP",
    root_path + "/VerilogVHDL",
    root_path + "/text",
    root_path + "/Python",
]
dataset_weights = [1.0, 4.0, 4.0, 1.0]
target_size = 20
```

This oversamples Verilog/VHDL and text, which is useful for chip-design-focused pretraining.

Shuffling occurs after blending:

```py frame="code" title="Shuffle after blend"
shuffle = nc.Shuffle(seed=42)
blended_dataset = shuffle(blended_dataset)
```

Without shuffling, the dataset would be grouped by source and can cause catastrophic forgetting. Interleaving source types in training batches stabilizes learning and improves retention.

:::note
[**Catastrophic forgetting**](https://www.ibm.com/think/topics/catastrophic-forgetting) happens because neural networks update weights via _gradient descent_. If you feed all Verilog first, those gradients push weights in one direction, then all-text gradients push them back. Interleaved batches mean each gradient update sees a mix, so no single domain dominates and overwrites another.
:::

<div align="center">

![Gradient descent animation](/gradient_descent.gif)

<small>

An animation of gradient descent. [Source](https://chengjun.github.io/mybook/08-05-gradient-descent.html).

</small>

</div>

The `seed=42` ensures reproducible shuffling for research.

### 1.23 Results

All 10 text documents passed quality checks. For code, 13,864 documents went in and 13,852 came out, with 12 dropped as duplicates or too short.

Curated data is written to `/data/curated/` and then split by category.

# 2. Custom Tokenization

![Tokenization diagram](/data_tokenization.png)

