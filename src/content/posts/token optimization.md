---
title: A Greedy Approach to Optimal Vocabulary Construction for Subword Tokenization
published: 2025-11-12T00:00:00-06:00 
description: The goal is to build a vocabulary that minimizes the number of tokens needed to represent text while keeping the total vocabulary size limited to control memory and embedding size. 
tags: [NLP, LLMs, Python]
category: Artificial Intelligence
draft: false
---

# Overview
Last weekend, I had the opportunity to participate in a research hackathon called [HackResearch](http://utrgv.hackresearch.com/site/). According to the website:

> Hack Research is a hackathon promoting critical thinking and theoretical Computer Science. This free event helps introduce students to several novel areas of research and professional tools, as well as connecting bright students with businesses and graduate schools. Hack Research is designed to showcase these skills that employers seek in a hackathon format, which could be described as an intense research workshop.

For the competition, I selected three problems that I wanted to tackle, one of them being the topic of today's post: 
_Optimal Vocabulary Construction for Subword Tokenization_. Please stay tuned for my future writeups over the other two!

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
**Tokenization** is a fundamental natural language processing (NLP) technique that breaks down text into smaller units called tokens, which can be words, sub-words, or characters. The tokens are then converted into numbers (embeddings). Embeddings are used by machine learning models. This process is essential because it converts unstructured text (from user prompts, for example) into a format that machines can understand and process for tasks like text classification!

If you come from a programming background, the reason why machines tokenize things is analogous to how they treat high-level programming languages. They translate high-level programs into low-level programs that they can understand. 

Therefore, subword tokenization is the process of breaking these words up into smaller parts.

A **vocabulary** is a list of these tokens. In the context of subword tokenization methods, like BPE, WordPiece, and Unigram, vocabularies are built based on the frequencies of word fragments. Rare words are highly fragmented [whereas the integrity of the most frequent words is preserved](https://aclanthology.org/2022.repl4nlp-1.10/) (Mofijul Islam et al., RepL4NLP 2022).

## Why should I care?
As LLMs are becoming a bigger and bigger part of our daily lives, the limits of what AI can generate is also being pushed higher and higher. The better we can create these tokenization algorithms, the better performance we can bring out of our LLMs. 

More efficient tokenization means:
- **Lower costs**: API providers like OpenAI charge per token - fewer tokens means cheaper API calls
- **Faster processing**: Fewer tokens to process means quicker response times
- **Better context utilization**: With limited context windows, efficient tokenization lets you fit more meaningful content

# The Problem

When you type text into ChatGPT or Claude, the model doesn't process individual letters or whole words. Instead, it breaks text into tokens - chunks that could be letters, parts of words, or whole words. The challenge is: **what's the best set of tokens to use?**

## Problem Formulation

Given:
- A corpus C = {s₁, s₂, ..., sₙ} consisting of text strings
- A maximum vocabulary size V_max
- A [cost function](https://www.reddit.com/r/learnmath/comments/csinhq/what_exactly_is_a_cost_function/) f_v(s) that represents the number of tokens needed to encode string s using vocabulary V

**Objective**: Find a vocabulary V* ⊆ Σ* of size at most V_max that minimizes the total encoding cost:
```
V* = argmin Σ f_v(s)
     |V|≤Vmax s∈C
```

## A Concrete Example

Let's say we have a corpus: `{"low", "lower"}` with vocabulary size limit of 5.

**Option 1**: Character-level vocabulary `{"l", "o", "w", "e", "r"}`
- "low" → [`l`, `o`, `w`] = 3 tokens
- "lower" → [`l`, `o`, `w`, `e`, `r`] = 5 tokens
- Total: 8 tokens

**Option 2**: Optimized vocabulary `{"low", "er", "o", "w", "e"}`
- "low" → [`low`] = 1 token
- "lower" → [`low`, `er`] = 2 tokens
- Total: 3 tokens

The second vocabulary is clearly better - it encodes the same corpus with 62.5% fewer tokens!

## The Computational Challenge

This problem has been proven to be **NP-hard**, meaning there's no known polynomial-time algorithm to find the optimal solution. This is where [approximation algorithms](https://www.cs.ucr.edu/~neal/publication/Klein99Approximation.pdf) become crucial. I'll definitely be writing another post about approximation algorithms in the future. For now, this paper covers what they are and how they apply here nicely.

# My Solution

I developed two complementary approaches to tackle this problem:

## 1. The Greedy Approximation Algorithm

The greedy algorithm builds a vocabulary iteratively by always adding the substring that provides the maximum immediate benefit:
```python
class GreedyTokenizer:
    def build_vocabulary(self, corpus):
        # Start with individual characters
        vocabulary = set(all_characters_in_corpus)
        
        while len(vocabulary) < max_vocab_size:
            # Find all possible substrings not yet in vocabulary
            candidates = generate_candidates(corpus)
            
            # Pick the one that saves the most tokens
            best_candidate = max(candidates, 
                               key=lambda c: calculate_savings(c, corpus))
            
            if savings(best_candidate) <= 0:
                break
                
            vocabulary.add(best_candidate)
        
        return vocabulary
```
:::note
This isn't the working code, just a simplified version of the function I actually used in the problem. Otherwise, this post would be more unneccessarily long and boring.
:::


### How Savings Are Calculated

For each candidate substring, we calculate:
- How many times it appears in the corpus
- How many tokens it would save (length - 1) × occurrences
- The candidate with highest savings wins

## 2. The Optimal Baseline

To evaluate our greedy algorithm, I also implemented a brute-force optimal solution:
```python
class OptimalTokenizer:
    def find_optimal(self, corpus):
        # Generate all possible substrings
        all_substrings = extract_all_substrings(corpus)
        
        # Try all combinations up to max_vocab_size
        best_vocab = None
        best_cost = infinity
        
        for vocab_combination in all_combinations(all_substrings):
            if len(vocab_combination) <= max_vocab_size:
                cost = encoding_cost(corpus, vocab_combination)
                if cost < best_cost:
                    best_cost = cost
                    best_vocab = vocab_combination
        
        return best_vocab
```

This gives us the theoretical best answer but becomes impractically slow for vocabularies larger than 12-15 tokens; it runs in exponential time. 

# Results and Analysis

I tested the algorithms on various corpus to understand how exactly they did against each other.

## Performance Comparison

| Test Case | Corpus | Greedy Cost | Optimal Cost | Ratio |
|-----------|--------|-------------|--------------|-------|
| Paper Example | {"low", "lower"} | 3 | 3 | 1.00 |
| Common Prefix | {"abc", "abd", "abe"} | 7 | 7 | 1.00 |
| Programming | {"func", "function"} | 3 | 3 | 1.00 |
| Word Suffixes | {"run", "running", "runner"} | 10 | 9 | 1.11 |
| Long Prefix | {"abcd", "abce", "abcf"} | 11 | 10 | 1.10 |

**Key Findings:**
- The greedy algorithm achieves optimal results in 62.5% of test cases
- Average approximation ratio: 1.05 (within 5% of optimal)
- Worst case observed: 1.11 (11% suboptimal)
- Greedy runs in milliseconds while optimal takes seconds even for small inputs

## Scaling Analysis

As vocabulary size increases:
- Greedy maintains O(n²m) time complexity (n = corpus size, m = string length)
- Optimal becomes exponentially slower: O(2^k) where k = number of possible substrings
- For V_max > 15, optimal becomes impractical (>10 seconds)

# Real-World Applications

## 1. API Cost Optimization
As previously mentioned, if we used less tokens, then API calls wouldn't be as expensive.

```python
# Example: Reducing OpenAI API costs
    original_text = "The functionality of the application..."
    optimized_tokens = optimize_tokenization(original_text)
    # Result: 30% fewer tokens = 30% lower cost
```

## 2. Domain-Specific Models
Some industries have common terms that we can keep completely intact to avoid tokenizing and wasting valuable tokens.

- **Medical NLP**: Keep medical terminology intact ("cardiovascular" as one token)
- **Code Models**: Preserve programming keywords ("function", "return", "import")
- **Legal Documents**: Maintain legal phrases ("pursuant to", "notwithstanding")

## 3. Multilingual Support
Different languages benefit from different tokenization strategies:
- English: Focus on common prefixes/suffixes
- Chinese: Character-based with common phrases
- Korean: Syllable blocks (Hangul) as base units

# Future Work

## Theoretical Improvements
1. **Approximation Bounds**: Prove that the greedy algorithm is always within a constant factor of optimal
2. **Dynamic Programming**: Explore whether the problem has optimal substructure properties
3. **Probabilistic Analysis**: Incorporate token frequency distributions from real-world corpora

## Practical Enhancements
1. **Hybrid Approaches**: Combine frequency analysis with greedy optimization
2. **Machine Learning Integration**: Use neural networks to predict good token candidates
3. **Incremental Updates**: Adapt vocabulary as corpus evolves without full reconstruction

## Implementation Optimizations
1. **Parallelization**: Evaluate candidates in parallel for larger corpora
2. **Caching**: Store intermediate tokenization results
3. **Approximate Counting**: Use [probabilistic data structures](https://www.geeksforgeeks.org/dsa/introduction-to-the-probabilistic-data-structure/) for massive corpora

# Conclusion

This research tackles a fundamental problem in NLP that affects every LLM in production today.

So why should you care about any of this?

The implications are significant:
- **Economic**: Reducing token counts directly reduces API costs
- **Performance**: Fewer tokens means faster processing and better context utilization
- **Scalability**: Efficient tokenization enables larger models to handle more data

As LLMs continue to grow in importance, optimizing their fundamental building blocks becomes increasingly critical. This work provides both theoretical insights and practical tools to address this challenge. Hopefully, in the future, I can make some real progress and formally contribute to this field. I'm grateful to HackResearch for encouraging me to learn more about something I had previously been clueless about. 

This is just the beginning. Thank you so much for reading! 