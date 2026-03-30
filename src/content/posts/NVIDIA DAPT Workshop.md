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

My university gave me the privilege of accessing NVIDIA's catalog of hands-on workshops for free. In this blog post, I cover _Domain-Adaptive Pre-Training: Tailoring LLMs for Specialized Applications_. This workshop is closely aligned with **NVIDIA's NeMo Curator ecosystem**: the hands-on lab uses NeMo Curator to ingest, clean, deduplicate, and filter domain-specific data before applying **DAPT**.

![NVIDIA's DAPT process for NeMo Chip LLM](/data-processing-training-domain-specific-llms-1024x270.jpg)

[Domain-Adaptive Pre-Training (DAPT)](https://marutitech.com/domain-adaptive-pretraining-llms/) is the process of further training pre-trained general LLMs on domain-specific data. For example, we might train an LLM on curated cybersecurity data to make it better at answering cyber-specific questions.

In this workshop, I dive into how to perform DAPT using NVIDIA's toolkit.

If you're curious, here are the dependencies for the notebook:

```bash frame="code" title="Install dependencies"
apt update
pip install "numpy<2" --break-system-packages
pip install datasets sentencepiece jsonlines tokenizers transformers torch ftfy matplotlib
pip install protobuf==3.20.1
pip install "huggingface_hub==0.24.6" --break-system-packages
```


# 1. Data Curation

The tutorial follows the steps below:

1. Install requirements and import libraries
2. Download the data from online sources (GitHub repos, wiki URLs, arXiv PDFs), extract metadata, and convert to **JSONL**
3. Load the dataset
4. Examine the file types and sizes (optional)
5. Run the data curation pipeline with **NeMo Curator**
    - File type identification and separation
    - Document-level exact deduplication
    - Heuristic-based quality filtering (number of lines, word count, top N-grams, etc.)
    - Fix **Unicode** errors via `ftfy`
    - **PII redaction**
    - **GPU-accelerated fuzzy and semantic deduplication**
6. Save the filtered and curated data
7. Blend datasets and shuffle

In the first part of the workshop, we curate data from different sources to prepare it for LLM training. I used NeMo Curator, NVIDIA's open-source library for scalable data curation, built on top of Dask for distributed computing.

<div align="center">

![Dask](/dask.png)

</div>

:::note
**Dask** parallelizes the pipeline across multiple workers, so instead of processing one document at a time, you can process partitions of documents simultaneously.
::: 


## Troubleshooting

When running the non-demo version of the DAPT Curation Jupyter Notebook, I encountered numerous issues, mostly due to outdated code. I fixed as many problems as possible so we could observe the full workflow instead of just the demo. The demo skips **blending/shuffling** and does not perform **PII redaction** or deduplication.

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
The raw data is processed through the [**curation pipeline**](https://developer.nvidia.com/blog/streamlining-data-processing-for-domain-adaptive-pretraining-with-nvidia-nemo-curator/):
- **Clean and unify formatting** (e.g., Unicode normalization)
- **Line-count filtering** to remove too-short documents
- **Exact deduplication** to remove identical documents
- **PII redaction** on code files using spaCy and Presidio recognizers

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

:::important
The data curation pipeline employs several deduplication techniques to improve data quality: **exact deduplication**, **fuzzy deduplication**, and **semantic deduplication**.
- [Exact deduplication](https://docs.nvidia.com/nemo/curator/latest/curate-text/process-data/deduplication/exact.html): removes identical documents.
- [Fuzzy deduplication](https://docs.nvidia.com/nemo/curator/25.09/curate-text/process-data/deduplication/fuzzy.html): finds and removes near-duplicates based on text similarity (e.g., MinHash). 
- [Semantic deduplication](https://docs.nvidia.com/nemo/curator/25.09/curate-text/process-data/deduplication/semdedup.html): uses model embeddings to find and remove documents with similar meanings.
:::

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

![Blending/shuffling animation](/blending_shuffling.gif)

<small>

**Blending** controls the training mix rather than using raw source proportions. Animation courtesy of Claude.

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
shuffle = nc.Shuffle(seed=42) # The `seed=42` ensures reproducible shuffling for research.
blended_dataset = shuffle(blended_dataset)
```

Without shuffling, the dataset would be grouped by source and can cause **catastrophic forgetting**. Interleaving source types in training batches stabilizes learning and improves retention.

:::note
[**Catastrophic forgetting**](https://www.ibm.com/think/topics/catastrophic-forgetting) happens because neural networks update weights via _gradient descent_. If you feed all Verilog first, those gradients push weights in one direction, then all-text gradients push them back. Interleaved batches mean each gradient update sees a mix, so no single domain dominates and overwrites another.
:::

<div align="center">

![Gradient descent animation](/gradient_descent.gif)

<small>

An animation of gradient descent. [Source](https://chengjun.github.io/mybook/08-05-gradient-descent.html).

</small>

</div>

### 1.23 Results

All 10 text documents passed quality checks. For code, 13,864 documents went in and 13,852 came out, with 12 dropped as duplicates or too short.

Curated data is written to `/data/curated/` and then split by category.

:::important
The purpose of data curation is to maximize LLM accuracy and reliability for specific tasks.
:::

# 2. Custom Tokenization

![Tokenization diagram](/tokenization-diagram.png)

## Goal
Given a tokenizer pretrained on general-purpose datasets (Original Tokenizer), our goal is to adapt it to a given domain. In the workshop, the example domain of choice is chip design.

When adapting a pretrained tokenizer to a given domain, the main goals are:
- Improve tokenization efficiency on domain-specific data.
- Maintain efficiency and language model performance on general-purpose datasets.
- Minimize the effort for retraining/fine-tuning.

Since we don't have access to the full general-purpose data used for pretraining the original tokenizer, we want to preserve the existing token mapping and ensure any new tokens are strictly an "extension."

Generally, when adapting a tokenizer to domain-specific data, the goal is to create a tokenizer that is better suited to the vocabulary and structure of that domain. This can improve efficiency and performance on tasks within that domain through efficient representation of domain-specific information.

:::note
**Tokens** are the fundamental building blocks of data that LLMs read and generate.

By performing custom tokenization, we add specialized chip-design jargon into the tokenizer's master dictionary.
:::

## Approach
The general approach we adopt is to train a **Domain Specific Tokenizer** from scratch on domain data and use it to identify domain-specific tokens that are missing from the **original tokenizer**. This is done by comparing the vocabularies of the **Original Tokenizer** and the newly trained **Domain Specific Tokenizer**. The missing domain-specific tokens are then added to the original tokenizer to produce the final **Domain Adapted Tokenizer**.

## Tradeoff
However, there is a tradeoff to adding missing domain-specific tokens to the original tokenizer.

For instance, adding a large number of domain-specific tokens can improve efficiency on domain-specific data, but the DAPT process may take longer because the loss can take longer to converge due to disruption of efficiency/performance on general-purpose data.

On the other hand, adding only a small number of domain-specific tokens can help maintain efficiency on general-purpose data, but may lack coverage on the domain-specific dataset.

## Balancing the Tradeoff
To balance this tradeoff, instead of adding all identified missing domain-specific tokens to the original tokenizer, we identify the most frequently occurring tokens using a threshold and only add the ones with usage frequencies above that threshold to get the final **Domain Adapted Tokenizer**.

For identifying the most frequently used tokens, we first extend the **Original Tokenizer** by adding all identified missing domain-specific tokens to get an **Extended Tokenizer**. The Extended Tokenizer is then applied to the domain-specific data in order to identify **high-frequency tokens**. Thus the Extended Tokenizer is just an intermediate step toward building a Domain Adapted Tokenizer.

Finally, the Original Tokenizer is extended using only high-frequency tokens to get the final Domain Adapted Tokenizer.

:::important
Only tokens with the highest usage frequency on the domain-specific data are added.
:::

![Token types](/tokenizer_vocab.gif)

Without further ado, let's get into the steps!

## 2.1 Training a tokenizer from scratch
The first step is training a new tokenizer from scratch using domain-specific data. We use facebook/opt-350m model as our _training template_. Notice how this is completely independent from the base/foundational model we'll be using later (llama-2-7b). 

```py frame="code"
data_root = "./curated_sample_data/curated_data/"
save_root = "./models/tokenizer/llama2/"
batch_size = 1000
vocab_size = 20000  # ~67% of Llama 2's 32k vocab

tokenizer = AutoTokenizer.from_pretrained("facebook/opt-350m")
tokenizer = tokenizer.train_new_from_iterator(
    data_iterator(data_root, keys, batch_size),
    vocab_size=vocab_size
)
tokenizer.save_pretrained(save_root)
```

There are various hyperparameters that are important:
- **Batch size**: depends on available memory.
    - Lower for limited memory environments.
    - Higher for high memory environments.
    - Batch size also depends on dataset size.
        - smaller datasets: smaller batch size to avoid overfitting
        - larger datasets: larger batch size for efficiency
- **Vocab size** depends on the original tokenizer (30-70% of original vocab size)
    - Specialized/technical domains and unique terminology require a larger vocabulary
    - This does not have to equal the number of new tokens that will be added
The original tokenizer model is **Llama2**.

## 2.2 Identify new domain tokens
From the vocabulary of the newly trained tokenizer, identify tokens that are absent in the general-purpose tokenizer and are rarely found in general-purpose datasets.

Then we adjust the general-purpose tokenizer to get an **extended tokenizer**.
- We add new tokens to the vocab of the original tokenizer.
- We expand/resize model embeddings of the original tokenizer with the newly identified tokens in step 2.

More important hyperparameters:
- **split**: number of partitions to split the embeddings (.pt files) for model parallelism
    - depends on hardware configuration: larger number of partitions for more GPUs
    - depends on available GPU memory
    - depends on model size: larger number of partitions for larger models (>13B, split = 8 or higher)
- **model_type**: original tokenizer model (`llama2`)

```py
split = 1       # number of .pt embedding partitions
model_type = "llama2"

# Adds missing tokens from the domain tokenizer to original Llama 2 vocab
# and resizes the embedding table to accommodate them
extend_tokenizer(vocab_size, split, model_type)
```

## 2.3 Token Usage Frequency Analysis
In this step, we analyze token usage frequency and get high frequency domain tokens.
- We apply the extended tokenizer to the domain-specific dataset
- Analyze the usage frequencies of the newly added tokens
- Select the top-K tokens with frequencies above a certain threshold (hyperparameter: **freq_threshold**)
- Add only the high-frequency tokens to the vocabulary of the original general-purpose tokenizer

Hyperparameters:

- **freq_threshold**
    - Lower (0.95-0.97) for highly specialized domains with rich technical vocabulary. This allows more domain-specific vocabulary.
    - Higher (0.98-0.99) for domains closer to general-purpose data. This avoids adding too many domain-specific tokens.
    - This hyperparameter helps balance the tradeoff between performance and resource constraints.
        - Adding more tokens increases embedding table size
        - Too many tokens may slow down convergence during DAPT pretraining

```py frame="code"
freq_threshold = 0.98  # keep tokens accounting for top 98% of usage
extended_tokenizer_path = f"./models/tokenizer/{model_type}/new_tokenizer/tokenizer_code_gen.model"

# Apply extended tokenizer to domain data and count token frequencies
analyze_token_usage(data_root, extended_tokenizer_path, batch_size, keys, token_usage_path)

# Select top-K tokens whose cumulative frequency reaches freq_threshold
get_high_freq_tokens(token_usage_path, high_freq_tokens_path, freq_threshold)
```

## 2.4 Initialize embeddings of new domain-specific tokens (Get the domain adapter tokenizer)
Embedding table and output-layer weights of the tokenizer depend on the _vocab size_.
1. Add high-frequency tokens identified previously to the original tokenizer vocab
2. Initialize embeddings of new tokens using the original tokenizer; it breaks down (tokenizes) a new token.
    - Embeddings of sub-tokens are averaged to initialize the embedding of the new token
3. Initialize weights in the output layer corresponding to the new token as the average of the sub-token weights

```py frame="code"
f = open(high_freq_tokens_path, "r")
new_tokens = json.load(f)
print("New tokens being added:", new_tokens)

# Adds high-freq tokens to original tokenizer vocab and initializes
# their embeddings as the average of their sub-token embeddings
extend_tokenizer_high_freq_tokens(
    data_root,
    ori_tokenizer_path,
    new_tokens,
    new_vocab_path,
    domain_adapter_tokenizer_path,
    old_ebd_path,
    new_ebd_path,
    split
)
```

## 2.5 Merge the new embeddings with the original embedding table
It's time to get to the final domain adapted tokenizer!

![Embedding tables](/embedding_tables.png)

Take a look at this diagram. On the left, we have the previous embedding table. Before custom tokenization, we had **3200 original tokens** and **768 padded tokens**.
- These 3200 original tokens belong to the general-purpose data.

After custom tokenization, we see an additional **1300 domain-specific tokens**. You still retain the original 3200 tokens while adding more domain-specific tokens. Notice how the number of columns stays the same: this represents the dimensionality of the token vectors. This implies that each token is still embedded in the same n-dimensional space.

```py frame="code"
old_ebd_path = f"./models/weight/{model_type}-hf"           # original HF weights
new_ebd_path = f"./models/weight/{model_type}/new_{model_type}-hf_weight"  # augmented embeddings
save_path    = f"./models/weight/new_merged_{model_type}-hf" # final merged weights

merge_embed(old_ebd_path, new_ebd_path, save_path)

print("Domain-adapted tokenizer:", domain_adapter_tokenizer_path)
print("Merged weights:", save_path)
```

# 3. Domain-Adaptive Pretraining (DAPT)

## Goal

Given a foundational language model (in this case **llama-2-7B**) that was pre-trained on a broad, general-purpose corpus, our goal is to further pretrain the model on a specific domain (in this example, **ChipDesign**) to enhance its understanding of domain-specific language and context. This process is called **Domain-Adaptive Pretraining (DAPT)**. DAPT adapts a general-purpose model to specialized tasks within a particular field. Instead of training from scratch, we aim to “specialize” the model by focusing on a target domain corpus, allowing it to adapt to the unique vocabulary, semantics, and syntax of that field.

Our primary goals with respect to DAPT are as follows:
* Improve the model’s performance and accuracy on domain-specific tasks
* Ensure the model retains general language capabilities
* Minimize pretraining time by leveraging existing knowledge in the model

DAPT typically enhances a model’s efficacy in downstream tasks for the domain by exposing it to domain-relevant texts. This pretraining phase can result in more accurate and context-aware predictions on domain-specific data, as the model gains an understanding of field-specific terminology, abbreviations, and common phrases.

![DAPT2](/dapt2.png)

:::important
The main objective of Domain-Adaptive Pretraining (DAPT) is to further pre-train a general-purpose model on a specific domain's data to improve its understanding of that domain's language and context. 
:::

Let's talk about a couple of important ideas first:

1. [Tensor and pipeline parallelism](https://insujang.github.io/2024-01-11/tensor-model-parallelism-and-sequence-parallelism-detailed-analysis/#tensor-model-parallelism): We split neural networks across GPUs for a reduced memory footprint. This technique allows large-scale training of LLMs across accelerated infrastructure.
    - **Tensor parallelism** enables sharding of the model, allowing very large models to fit into GPU memory
    - **Pipeline parallelism** reduces activation memory overhead, maximizing GPU utilization
    - **Data parallelism** shards the input data into batches, with each batch of data trained on the entire model. [Source](https://expertofobsolescence.substack.com/p/demystifying-distributed-checkpointing)
2. [Sequence parallelism](https://insujang.github.io/2024-01-11/tensor-parallelism-and-sequence-parallelism-detailed-analysis/#difference-in-sequence-token-and-batch): We work with tensor processing to increase the batch size that can support training.
3. [Selective activation recomputation](https://docs.nvidia.com/nemo/megatron-bridge/0.2.0/training/activation-recomputation.html): Smart activation checkpointing allows us to only save essential data and recompute it as needed.
4. **[Distributed checkpointing](https://expertofobsolescence.substack.com/p/demystifying-distributed-checkpointing)** is crucial and is another key feature when training LLMs across multiple GPUs or nodes.
    - Allows us to save, load, and restore even if the training parallelism strategy changes.

```py frame="code"
import nemo_run as run
from nemo.collections import llm
from nemo.collections.llm import Llama2Config7B

# Configure recipe to pre-train based on the default Llama-2-7B recipe
def configure_recipe(nodes: int = 1, gpus_per_node: int = 1):
    recipe = llm.llama2_7b.pretrain_recipe(
        name="llama2_7b_dapt",
        num_nodes=nodes,
        num_gpus_per_node=gpus_per_node,
    )

    # Set parallelism and validation parameters
    strategy = recipe.trainer.strategy
    strategy.context_parallel_size = 1
    strategy.tensor_model_parallel_size = 1
    recipe.trainer.val_check_interval = 10

    return recipe

# Executor for running pretraining 
def local_executor_torchrun(devices: int = 1) -> run.LocalExecutor:
    executor = run.LocalExecutor(ntasks_per_node=devices, launcher="torchrun")
    return executor
```

## 3.1 Evaluation
Broadly, we can evaluate our models based on quantitative or qualitative evaluations.

1. Quantitative:
    - **Metrics**: perplexity, ROUGE, BLEU, cosine similarity, etc.
    - **Benchmark datasets**
    - **LLM-as-a-judge**: numerical scoring
    - **Adversarial**: failure rates, accuracy drops, etc.
2. Qualitative:
    - **Human-eval**: based on criteria like relevance, coherence, factuality, and overall quality
    - **Adversarial**: human-verified errors
    - **LLM-as-a-judge**: subjective scoring of coherence, persuasiveness, etc.

- General-purpose benchmarks: to ensure the model retains information from pretraining.
- Task-specific benchmarks: to test the model on newly learned domain knowledge
- Adversarial benchmarks: test robustness by presenting the model with tricky or misleading inputs.

:::important
We convert the data from `.jsonl` to bin/idx to enable efficient, high-throughput data loading and reduce I/O bottlenecks during training. 
:::

```py frame="code"
import nemo.lightning as nl
from nemo.collections.common.tokenizers import AutoTokenizer

# Define dataset configuration
data = run.Config(
    llm.PreTrainingDataModule,
    paths=['/dli/task/03_domain_adaptive_pretraining/preprocessed_data_text_document'],
    seq_length=4096,
    tokenizer=run.Config(
        AutoTokenizer,
        pretrained_model_name="/dli/task/02_custom_tokenizer_training/models/weight/llama2-7b-hf",
    ),
    micro_batch_size=1,
    global_batch_size=8,
)

# Instantiate the recipe
recipe = configure_recipe(nodes=1, gpus_per_node=2)

# Configure resume settings
recipe.resume = run.Config(
    nl.AutoResume,
    restore_config=run.Config(nl.RestoreConfig, path="/root/.cache/nemo/models/llama2-7b-hf"),
)

# Ensure tokenizer is set
recipe.data.tokenizer = data.tokenizer

# Configure parallelism settings
recipe.trainer.strategy.tensor_model_parallel_size = 2
recipe.trainer.strategy.pipeline_model_parallel_size = 1
recipe.trainer.strategy.context_parallel_size = 1

# Configure training steps and validation intervals
recipe.trainer.max_steps = 20
recipe.trainer.max_epochs = 1
recipe.trainer.val_check_interval = 10
recipe.trainer.limit_val_batches=5

# Set batch size settings
recipe.data.global_batch_size = data.global_batch_size
recipe.data.micro_batch_size = data.micro_batch_size
recipe.data.num_val_samples = 128  # Adjust based on dataset size

# Set checkpoint and log locations
recipe.log.log_dir = "/workspace/logs_03_15"
recipe.log.ckpt.save_optim_on_train_end = True

# Configure learning rate scheduler
recipe.optim.config.lr = 1e-5
recipe.optim.lr_scheduler.min_lr = 1e-6

# Assign dataset configuration
recipe.data = data

# Configure data blending (if needed)
recipe.data.paths = [1, '/dli/task/03_domain_adaptive_pretraining/preprocessed_data_text_document']
```

# 4. Supervised Fine-Tuning (SFT)
![Model customization for enterprise ready LLMs](/Lifecycle-generative-AI-application.png)

[**Supervised fine-tuning (SFT)** ](https://docs.nvidia.com/nemo-framework/user-guide/25.04/automodel/sft.html) enables a pre-trained model to specialize in a given domain by training it on labeled data, refining its responses while preserving the broad knowledge acquired during pretraining.
- SFT updates a larger portion (or even all) of the model weights.
- SFT is also referred to as "instruction tuning" where we use SFT to teach a model to follow instructions better.
- SFT requires a task-specific dataset (input-output pairs).

```py frame="code"
# with all above components created, call NeMo2.0 finetune API
def configure_finetuning_recipe():
    return run.Partial(
        llm.finetune,
        model=llama2_7b(),
        trainer=trainer(),
        data=verilog(),
        log=logger(),
        optim=adam_with_cosine_annealing(),
        resume=resume(),
    )


def local_executor_torchrun(nodes: int = 1, devices: int = 2) -> run.LocalExecutor:
    # Env vars for jobs are configured here
    env_vars = {
        "TORCH_NCCL_AVOID_RECORD_STREAMS": "1",
        "NCCL_NVLS_ENABLE": "0",
    }

    executor = run.LocalExecutor(ntasks_per_node=devices, launcher="torchrun", env_vars=env_vars)
    return executor
    
print("running supervised fine tuning!")
run.run(configure_finetuning_recipe(), executor=local_executor_torchrun())
```

## Key Technical Learnings
When fine-tuning, here are some key points to know:
- Start from DAPT or instruction fine-tuned models
- Use a **domain-adapted tokenizer**
- Use data parallelism, tensor parallelism, and pipeline parallelism in your parallelism strategy
- **Loss function**: prediction loss with optional regularization (e.g., KLD with a reference model)
- Learning rate: use a smaller LR than DAPT
    - Easier to overfit on smaller, high-quality, curated SFT data
    - Higher risk of catastrophic forgetting
- **Overfitting prevention**:
    - early stopping with cross-validation
    - mixture-of-experts (MoE) architecture

For evaluation:
- **Human-in-the-loop**: Reinforcement learning from human feedback (**RLHF**)
    - Pros: accurate feedback from domain experts
    - Cons:
        - slow to collect feedback
        - subjective bias
- **LLM as a judge**
    - Pros: quick
    - Cons:
        - biased by its training data
        - hallucinate on domain-specific questions
        - sensitivity to prompts

:::important
SFT yields better performance when built on top of a DAPT model, rather than starting from a generic base model.
:::

# Conclusion
So we learned a lot in this workshop. In order: 

1. We learned about **data curation**. Data curation is an important part of the DAPT pipeline as it helps us maximize LLM accuracy and reliability for specific tasks. We use techniques like **data deduplication**, **PII redaction**, etc.
2. Next, we looked into **custom tokenization**. We trained a Domain Specific Tokenizer from scratch to identify domain-specific tokens that were missing from the original tokenizer. We balanced the tradeoff by identifying the most frequently occurring tokens and adding those to create the domain adapted tokenizer.
3. Then, we got into the real meat of this workshop: DAPT. We took a pre-trained, foundational model (llama-2-7B) and further pre-trained it.
4. Lastly, we used supervised fine-tuning (SFT), which involved the refining of the LLMs knowledge using enterprise data.


The ChipNeMo paper that inspired this workshop showed measurable improvements on chip design tasks over the base Llama 2 model. This workshop is a hands-on reproduction of that methodology at a smaller scale. 

If you're working on a domain-specific LLM problem, whether in cybersecurity, medicine, law, or hardware design, the pipeline here is a solid starting point.

Thank you for reading! Feel free to reach out if you'd like to talk about anything. :)
