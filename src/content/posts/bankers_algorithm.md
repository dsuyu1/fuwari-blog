---
title: "Bankers Algorithm in C"
published: 2025-12-12T00:00:00-08:00
tags: [C]
category: Operating Systems
draft: true
---

Bankers's algorithm is a dynamic **deadlock avoidance** algorithm used in operating systems. It ensures that the system remains in a _safe state_ (a state where deadlock is not possible). 
Banker's algorithm keeps track of what resources each program needs and what's available - programs only get what they need in a safe order.

In our implementation, Banker's algorithm uses a **claim graph** that can be represented as a set of arrays. The claim graph consists of:
- Processes
- Multi-unit resources
- Request edges
- Allocation edges
- Claim edges 

