---
title: "VISI Virtual SOC (VSOC) Lab Part 1: Setting up Wazuh, VPC Subnet, & Firewall Rules"
published: 2026-2-6T00:00:00-08:00
tags: [VISI, Labs, Wazuh]
category: Cybersecurity
image: /soc.jpg
draft: true

---
# Introduction
This is a walkthrough for how to create a virtual soc that others can access, complete with subnets and machine set-ups. 
I used this procedure to set up my own virtual SOC environment for my cybersecurity club. Learn more about us [here](https://vaqueroisi.org/).

# 1. Setting up Wazuh
Download and run the Wazuh installation assistant.

```
curl -sO https://packages.wazuh.com/4.14/wazuh-install.sh && sudo bash ./wazuh-install.sh -a
```

Once the assistant finishes the installation, the output shows the access credentials and a message that confirms that the installation was successful.

```
INFO: --- Summary ---
INFO: You can access the web interface https://<WAZUH_DASHBOARD_IP_ADDRESS>
    User: admin
    Password: <ADMIN_PASSWORD>
INFO: Installation finished.
You now have installed and configured Wazuh.
```

Access the Wazuh web interface with `https://<WAZUH_DASHBOARD_IP_ADDRESS>` and your credentials.

When you access the Wazuh dashboard for the first time, the browser shows a warning message stating that the certificate was not issued by a trusted authority. This is expected and the user has the option to accept the certificate as an exception or, alternatively, configure the system to use a certificate from a trusted authority.

# 2. VPC and Subnets
Analyst machines and hosts will be in the same VPC but on different subnets
- Analyst subnet:  `10.0.0.0/24`
- Vulnerable host/test subnet: `10.0.1.0/24`
- 
# 3. Enabling External Access
There are several ways to let users into your network. In this guide, we'll use a **bastion host** or **jump box**. That is, a host in a public subnet with a public IP that, once authenticated, allows access to internal servers and machines.



