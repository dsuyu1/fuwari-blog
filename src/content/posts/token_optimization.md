---
title: Greedy Approximation Algorithm for Optimal Vocabulary Construction in Subword Tokenization
published: 2025-11-12T00:00:00-06:00 
tags: [NLP, LLMs, Research, Python]
category: Artificial Intelligence
draft: true
---

# Overview
Last weekend, I had the opportunity to participate in a research hackathon called [HackResearch](http://utrgv.hackresearch.com/site/). According to the website:

> Hack Research is a hackathon promoting critical thinking and theoretical Computer Science. This free event helps introduce students to several novel areas of research and professional tools, as well as connecting bright students with businesses and graduate schools. Hack Research is designed to showcase these skills that employers seek in a hackathon format, which could be described as an intense research workshop.

For the competition, I selected three problems that I wanted to tackle, one of them being the topic of today's post: 
_Optimal Vocabulary Construction for Subword
Tokenization_. Please stay tuned for my future writeups over the other two!

In this post, I'll give an introduction into:
- Important vocabulary (tokenization, vocabularies, corpus, etc.)
- Applications of our research in real-world applications (Why should we care?)
- The proposed research question
- My initial solution
- Future works

If you want to skip the explanation and look at the code, please visit my Github repo below.

::github{repo="dsuyu1/token-optimization"}

Without further ado, let's get into it!

---

# Introduction
## What is tokenization?
**Tokenization** is a fundamental natural language processing (NLP) technique that breaks down text into smaller units called tokens, which can be words, sub-words, or characters. The tokens are then coverted into numbers (embeddings). Embeddings are used by machine learning models. This process is essential because it converts unstructured text (from user prompts, for example) into a format that machines can understand and process for tasks like text classification!

If you come from a programming background, the reason why machines tokenize things is analogous to how they treat high-level programming languages. They translate high-level programs into low-level programs that they can understand. 

Therefore, subword tokenization is the process of breaking these words up into smaller parts.

A **vocabulary** is a list of these tokens. In the context of subword tokenization methods, like BPE, Word-Piece, and Unigram, vocabularies are built based on the frequencies of word fragments.  Rare words are highly fragmented [whereas the integrity of the most frequent words is preserved](https://aclanthology.org/2022.repl4nlp-1.10/) (Mofijul Islam et al., RepL4NLP 2022).