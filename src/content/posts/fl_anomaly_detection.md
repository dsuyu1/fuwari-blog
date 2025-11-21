---
title: "Analysis of Byzantine-Robust Aggregation Strategies in Federated Learning"
published: 2025-11-20T00:00:00-08:00
description: How do we deal with Byzantine attacks?
tags: [Federated Learning, Cybersecurity, Python]
category: Artificial Intelligence
draft: false
---

Federated learning (FL) is a machine learning technique that trains models on decentralized data without exchanging any raw data. It trains across distributed clients without centralizing sensitive data.

However, this presents an issue: what if one or more of these clients submit poisoned (bad) updates to degrade the global model's integrity? How do we deal with malicious, anomalous updates to our global model? 

<div align="center">

![Federated learning model](https://media.geeksforgeeks.org/wp-content/uploads/20230717153929/Federated-Learning-(1).png)

#### Source: [Geeks For Geeks](https://www.geeksforgeeks.org/machine-learning/collaborative-learning-federated-learning/)

</div>

## The Problem: Byzantine Attacks

**Byzantine attacks** occur when malicious clients submit poisoned updates to compromise the global model. Among these threats, **label flipping attacks**—where attackers intentionally mislabel their training data—are one of the simplest yet still concerning threats. 

Without any defenses, these attacks can devastate model performance. In our experiments, accuracy degraded severely under attack, oscillating between 9% and 85% and exhibiting unstable convergence. Attackers increased the final loss by 3× compared to a clean baseline.

> **Byzantine-robust federated learning** aims at _mitigating_ Byzantine failures during the federated training process, where malicious participants (known as Byzantine clients) may upload arbitrary local updates to the central server in order to degrade the performance of the global model. [(Li et al., 2023)](https://ieeexplore.ieee.org/abstract/document/10018261)

## Research Framework

This research was conducted using a custom-built Knowledge Management Framework for Federated Learning, built on top of [Flower](https://flower.ai/). The framework provides:

- **Plug-and-play aggregation strategies**: Easy integration of custom Byzantine-robust defenses
- **Unified metrics collection**: Consistent logging across different strategies
- **Flexible configuration**: JSON-based simulation parameter management
- **Comparative analysis**: Ability to run multiple strategies and visualize results side-by-side

The framework supports multiple datasets including FEMNIST (IID and non-IID), PneumoniaMNIST, and BloodMNIST, with configurable attack scenarios and defense mechanisms.

You can find the code at my GitHub repository below. 

:::note
The framework is not mine! It was provided to me via a research group I am in.
:::

::github{repo="dsuyu1/anomaly-detection-fl"}

## Byzantine-Robust Defenses

To combat these attacks, we need Byzantine-robust aggregation strategies—methods that can filter or down-weight abnormal updates from malicious clients. We evaluated four different defense mechanisms:

### 1. Krum

[Krum](https://ieeexplore.ieee.org/document/10427404) selects the client update most similar to others, choosing a single update that minimizes the sum of distances to its nearest neighbors. While provably Byzantine-resilient in theory, our experiments showed it underperformed due to single-client selection instability, achieving only 12.8% accuracy.

**Configuration**: `k = 1` (single selection)

### 2. Multi-Krum

An extension of Krum that aggregates multiple trusted updates rather than selecting just one. This proved to be our best performer, achieving **92.9% accuracy** while maintaining 80% detection capability. Multi-Krum effectively balanced aggregating trusted updates while filtering out poisoned ones.

**Configuration**: `k = 8` (8 selections from 10 clients)

### 3. [Trimmed Mean](https://www.sciencedirect.com/science/article/abs/pii/S0957417424032214)

This coordinate-wise approach removes **statistical outliers** from each dimension before aggregation. However, it suffered from excessive trimming in our experiments, achieving only 19.4% accuracy. We found it required very careful tuning—aggressive client removal caused system collapse in early trials.

**Configuration**: `β = 0.2` (trim ratio, reduced from higher values to prevent instability)

### 4. [PID-Based Detection](https://arxiv.org/html/2411.02152v1)

An adaptive strategy that dynamically adjusts detection thresholds based on observed attack patterns. While achieving slightly lower accuracy (90.2%) than Multi-Krum, PID demonstrated **perfect malicious client identification** with an F1-score of 1.0.

**Configuration**: 
- `Kp = 1.5` (Proportional gain)
- `Ki = 0.1` (Integral gain)  
- `Kd = 0.1` (Derivative gain)
- `σ = 1.5` (standard deviations for threshold)

## Experimental Setup

We simulated a federated learning system with the following configuration:

- **Dataset**: FEMNIST (IID distribution) - handwritten digit subset (0-9), 10 classes
- **Clients**: 10 total (varying percentages malicious)
- **Training**: 20 rounds, 2 local epochs, batch size 32
- **Attack**: Label flipping initiated at Round 1
- **Defenses**: Activated at Round 3
- **Device**: CPU execution

### Experimental Design

We conducted four experiments to evaluate defense performance:

| Experiment | Malicious % | Defense | Objective |
|------------|-------------|---------|-----------|
| Exp 1 | 0% | None | Baseline performance |
| Exp 2 | 20% | None | Attack impact |
| Exp 3 | 20% | All 4 | Defense comparison |
| Exp 4 | 10-30% | Krum | Scalability analysis |

## Key Findings

### Defense Performance Comparison (20% Malicious Clients)

| Defense | Accuracy | Detection | F1 Score |
|---------|----------|-----------|----------|
| Krum | 0.128 | 0.80 | 0.889 |
| **Multi-Krum** | **0.929** | 0.80 | 0.889 |
| Trimmed Mean | 0.194 | 0.70 | 0.824 |
| **PID** | 0.902 | **1.00** | **1.000** |

### Attack Impact Without Defense

| Scenario | Round 1 | Round 10 | Round 20 |
|----------|---------|----------|----------|
| Baseline (0% malicious) | 0.23 | 0.74 | **0.84** |
| Attack (20% malicious) | 0.14 | 0.19 | 0.85 |

The undefended attack scenario shows severe instability in convergence, with accuracy bouncing dramatically throughout training despite ending at a deceptively high value.

### The Byzantine Fault Tolerance Limit

One of our most significant findings was the empirical confirmation of the theoretical Byzantine fault tolerance threshold. When malicious clients exceeded 30% of the network, all defenses collapsed:

| Malicious Clients | Krum Accuracy | Detection | F1 Score |
|-------------------|---------------|-----------|----------|
| 1 (10%) | 0.896 | 0.90 | 0.947 |
| 2 (20%) | 0.883 | 0.80 | 0.889 |
| 3 (30%) | **0.241** | 0.70 | 0.824 |

This confirms the theoretical Byzantine bound: **f < n/3**, where f is the number of faulty (malicious) nodes and n is the total number of nodes. Beyond this threshold, even the most sophisticated defenses cannot maintain model integrity.

## Trade-offs and Practical Considerations

Our research reveals important trade-offs for real-world deployment:

**Multi-Krum** provides the best accuracy-robustness balance (92.9% accuracy) but with moderate detection capability (80%). This makes it ideal for scenarios where maintaining model performance is the primary concern.

**PID-based detection** achieves perfect attacker identification (100% detection) with slightly lower accuracy (90.2%). This is preferable when security and audit requirements demand confirmed identification of malicious actors.

**Computational overhead** remains practical across all strategies. Score calculation time grows slightly with higher attacker ratios but stays within acceptable limits for production systems, measured in nanoseconds per round.

## System Limitations and Recommendations

During our implementation, we encountered several practical challenges that inform recommendations for production systems:

### 1. Inconsistent Logging Infrastructure

Different aggregation modules used incompatible logging formats, requiring manual metric aggregation. This became particularly problematic when comparing strategies side-by-side.

**Recommendation**: Implement unified, strategy-agnostic logging at the server level. Our framework now provides standardized metrics collection including:
- Client-level metrics: Loss, accuracy, removal criteria, distance from cluster centers
- Round-level metrics: Average loss and accuracy across participating clients

### 2. Hyperparameter Sensitivity

Trimmed Mean exhibited pathological behavior with aggressive trimming. Initial experiments with higher trim ratios caused complete system collapse.

**Recommendation**: Start with conservative parameters and tune incrementally. For Trimmed Mean, we found `β = 0.2` provided stable performance, far lower than typical recommendations in literature.

### 3. Small Network Effects

Both single-client Krum and Trimmed Mean showed instability in our 10-client network, suggesting these methods may require larger deployments to function reliably.

**Recommendation**: Test defenses at the expected production scale. Our framework supports up to 100 clients (dataset dependent) for more realistic evaluation.

### 4. Configuration Management

Managing multiple experimental configurations became complex when comparing strategies across different parameters.

**Recommendation**: Based on what I did, I would use the framework's JSON-based configuration system with `shared_settings` and `simulation_strategies` sections to enable systematic parameter variation while maintaining reproducibility. It was easy to just change the parameters and keep running the simulations over and over again in Google Colab.

Some additional things to note:

- **Single-client Krum**: Too unstable for small federations
- **Trimmed Mean alone**: Requires extensive tuning and monitoring (we don't want to trim too much)
- **No defense**: Even 10% malicious clients cause severe degradation

## Implementation Example

Here's a sample configuration for deploying Multi-Krum with PID detection in the framework:
```json
{
  "shared_settings": {
    "num_of_rounds": 20,
    "num_of_clients": 10,
    "dataset_keyword": "femnist_iid",
    "attack_type": "label_flipping",
    "begin_removing_from_round": 3,
    "num_of_client_epochs": 2,
    "batch_size": 32,
    "training_device": "cpu",
    "remove_clients": true,
    "save_plots": true,
    "save_csv": true
  },
  "simulation_strategies": [
    {
      "aggregation_strategy_keyword": "multi-krum",
      "num_of_malicious_clients": 2,
      "num_krum_selections": 8
    },
    {
      "aggregation_strategy_keyword": "pid",
      "num_of_malicious_clients": 2,
      "num_std_dev": 1.5,
      "Kp": 1.5,
      "Ki": 0.1,
      "Kd": 0.1
    }
  ]
}
```

This configuration runs both strategies for direct comparison, outputting plots and CSV files for analysis.

## Future Directions

This work opens several promising research directions:

### Hybrid Defense Architectures
Combining Multi-Krum's accuracy with PID's detection capabilities could provide the best of both worlds. A two-stage approach using Multi-Krum for aggregation and PID for monitoring warrants investigation.

### Adaptive Hyperparameter Optimization
Rather than static configurations, develop systems that automatically tune parameters based on observed attack patterns. This could extend the defensive capabilities beyond the 30% threshold.

### Non-IID and Realistic Data Distributions
Our experiments used IID FEMNIST. Real-world FL deployments face heterogeneous data distributions. The framework supports non-IID datasets (FEMNIST non-IID, FLAIR) for future testing.

### Advanced Attack Models
Beyond simple label flipping, evaluate defenses against:
- Model poisoning attacks
- Backdoor injection
- Gradient manipulation
- Adaptive attackers that respond to defenses

The [ATLAS Matrix](https://atlas.mitre.org/matrices/ATLAS) provided by MITRE maps different adverserial techniques to different tactics. I encourage you to take a look!

## Conclusion

Byzantine-robust aggregation is essential for securing federated learning systems against malicious clients. Our comparative analysis demonstrates that **Multi-Krum offers the best accuracy-robustness trade-off** for most scenarios (92.9% accuracy, 80% detection), while **PID-based detection excels at identifying attackers** (90.2% accuracy, 100% detection).

However, all defenses face fundamental limits—when attackers exceed 30% of participants, even the best strategies fail. This empirical confirmation of the Byzantine fault tolerance bound (f < n/3) has critical implications for system design.

The combination of theoretical Byzantine fault tolerance and practical evaluation provides a clear framework for building robust, production-ready federated learning systems.

Overall, because the simulations and research was conducted at Hack Research (similar to my token optimization project), the data I got isn't the most accurate. In the future, I hope to get more comfortable with the framework. 

If you're interested in the topic, please reach out! [Here's](https://arxiv.org/abs/2502.06917) a really cool paper I found that combines blockchain and FL. Thank you for reading!