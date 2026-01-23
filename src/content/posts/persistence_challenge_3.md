---
title: "Persistence Challenge 3"
published: 2026-1-22T00:00:00-08:00
tags: [Rangeforce, Incident Response]
category: Cybersecurity
draft: true
---

TO find IP address look for most requests to server

To find persistence, remove suspicious keys file

Problems:

Unusual Location: /boot/grub/.ssh/authorized_keys is an extremely uncommon and suspicious location for authorized keys
Persistence Mechanism: Placing SSH keys in /boot/grub/ could be an attacker's attempt to:

Hide unauthorized access
Maintain persistence across system updates
Avoid detection (admins rarely check /boot/grub/ for SSH keys)


Boot Partition Access: This location survives even aggressive cleaning of user directories