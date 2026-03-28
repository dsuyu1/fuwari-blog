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

## Reviewing the Data Curation Pipeline

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

So what exactly happened? 
1. Data Collection: We downloaded raw data from three sources: Wikipedia (text), GitHub repositories (code), and arXiv PDFs. These represent the domain-specific knowledge you'd use to fine-tune a language model. 
2. Data Curation: The raw data was then run through a curation pipeline. This included cleaning and unifying the formatting (like fixing unicode issues), filtering by line count to remove trivially short documents, exact deduplication to remove identical document, and PII redaction on code files.
- The PII redaction was done with the[spaCy](https://spacy.io/) and [Presidio](https://microsoft.github.io/presidio/) recognizers. We stripped emails, phone numbers, SSNs, etc.

Looking at the results, we can see that all 10 text documents passed the quality filters (none were dropped). However, for the code, we had 13,864 documents in, and 13,852 out; 12 documents were dropped as duplicates or were too short. 

The curated data was written to /data/curated/
