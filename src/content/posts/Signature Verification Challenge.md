---
title: "RangeForce: Signature Verification Challenge"
published: 2026-2-20T00:00:00-08:00
tags: [Rangeforce, GPG, Walkthrough]
category: Cybersecurity
image: /gpg.png
draft: false
---

# Introduction

Interesting challenge from Rangeforce. I learned something new. Here's the challenge:

> As a security analyst, you have been asked to investigate a supply chain attack involving a malicious actor forging a git commit using someone else's identity. The security team has provided you with a record of the signed commit messages suspected to have been compromised. Your task is to identify the forged commit message, taking into consideration the legitimate public keys of the developers.

In a git signing scenario, a developer uses their **private key to sign a commit.** Anyone with their **public key can verify that the commit actually came from them and hasn't been altered.** A "forged" signature usually means the contents of the message don't match the signature provided (integrity failure) or it was signed by a key that doesn't belong to the claimed author.

# 1. Identify the Forgery
> The signed git commit messages can be found in /home/student/messages/ and the public keys of the developers are located in /home/student/keys/ . With this information, can you find the message with a forged signature?

- Identify the forged signature.
- Answer the questions.

#### 1. _Which RSA key did you use to find the bad signature? Answer with the key as displayed by `gpg`._

Answer: **991D55A8CF0EB6FF7342C6FC04160FFF24F64162** 

First, feed the keys you're given to GPG's keyring with `gpg --import /home/student/keys/*`. Then, verify the messages with `gpg --verify`.

![](/src/assets/images/svc1.png)

![](/src/assets/images/gpgp2.png)

#### 2. _What is the full path to the commit message with the forged signature?_

Answer: **/home/student/messages/49799bc3.txt** 

#### 3. _What is the email address of the developer whose identity was stolen?_

Answer: **rachel.smith@commensuratetechnology.com** 

