---
title: "RangeForce: Junior SOC Analyst 2 Capstone"
published: 2026-1-23T00:00:00-08:00
tags: [Rangeforce, Incident Response, Walkthrough]
category: Cybersecurity
image: /rangeforce2.png
draft: false
---

# Part 1: Phishing Email
All answers to the question can be found using the provided email contents and the SHA-256 hash of the executable.

1. _What is the subject line of the email?_

`Application for the Position of Software Developer`

2. _Who sent the email?_

jsmythe1337@protonmail.com

3. _Who received the email?_

Lorrie.Hayter@commensuratetechnology.com

4. _What is the name of the attachment?_

`Jonathan Smythe CV.exe`

5. _What is the name of the trojan malware the attachment is suspected to contain?_

You can find the hash using `sha256sum` in the command line. I submitted the hash to VirusTotal and found the trojan name.
[dridex](https://www.virustotal.com/gui/file/97435ab8be1983337bf241ccc693f6bbe57be3ac2e1920703de78523be97c041)

6. _What is the SHA-256 hash of the malware?_

`97435ab8be1983337bf241ccc693f6bbe57be3ac2e1920703de78523be97c041`

# Part 2: Ransom Note
You can use the contents of the ransom note itself to find the ransomware name. For example, notice how there's a spelling mistake in the ransom note. 

```
Your network has been penetrated.

All files on each host in the network have been encrypted with a strong algorythm.

Backups were either encrypted or deleted or backup disks were formatted.
Shadow copies also removed, so F8 or any other methods may damage encrypted data but not recover.

We exclusively have decryption software for your situation
No decryption software is available in the public.

	DO NOT RESET OR SHUTDOWN - files may be damaged.
	DO NOT RENAME OR MOVE the encrypted and readme files.
	DO NOT DELETE readme files.
	DO NOT use any recovery software with restoring files overwriting encrypted.
	This may lead to the impossibility of recovery of the certain files.


To get info (decrypt your files) contact us at your personal page:

	1. Download and install Tor Browser: https://www.torproject.org/download/
	2. After a successful installation, run the browser and wait for initialization.
	3. Type in the address bar:

		http://q7wp5u55lhtuafjtsl6lkt24z4wvon2jexfzhzqqfrt3bqnpqboyqoid.onion/order/b65dd758-e6bf-11e9-9468-00163eea179c

	4. Follow the instructions on the site
	5. You should get in contact in 48 HOURS since your systems been infected.
	6. The link above is valid for 7 days.
	   After that period if you not get in contact
	   your local data would be lost completely.
	7. Questions? e-mail: btpsupport@protonmail.com
	   If email not working - new one you can find on a tor page.


The faster you get in contact - the lower price you can expect.

DATA
EAAAAA9/KC0FPhxbi+7ybfqMDgkBAgAAEGYAAACkAAD1SOTp+I8+FsWi8BScNnhSrfqL49jz00fj
ue6Ega4hUeV4QGDEJ4sreCfUultJ9KjMZSrQ2GA4eanv48nPEM51zXx5W5orwapLRIGi9gvcQmwc
80V3MGXLdm7fkq3VY9cPLCNu31bmbr/GafflevxqH96nkMFMZ8rPsqfFKpOzM6NCr4ZnEMvIxN/c
7raXT4ZaWA4e/LKZcXkneDiyikVIBaWB4jhgQpl2rUBapxdh0sxHYQvd5KdVdB/m7Cg/mD5FEJtF
FXGp1P0mggYCx3oEo+IpdKdPTohqL5wfTDgMKblsHtQKTD9QMw37SpKI5G6uEXs5zUOiPmcSvOdI
mw5u
```

1. _What application are you instructed to download and install in the ransom note?_

Tor
	
2. _What email is provided in the ransom note if you have any questions?_

btpsupport@protonmail.com
	
3. _What is the variant of ransomware?_

[DoppelPaymer](https://id.provendata.com/ransomware/bitpaymer-doppelpaymer/unknown-022)

Apparently this ransomware has no decryption algorithm yet.

4. _What is the URL that can be found in the ransom note?_

http://q7wp5u55lhtuafjtsl6lkt24z4wvon2jexfzhzqqfrt3bqnpqboyqoid.onion/order/b65dd758-e6bf-11e9-9468-00163eea179c

# Part 3: Malware and C&C

```bash
student@desktop:~$ ss -atp
State  Recv-Q Send-Q        Local Address:Port                     Peer Address:Port                  Process                                                   
LISTEN 0      128                 0.0.0.0:ssh                           0.0.0.0:*                                                                               
ESTAB  0      0               192.168.6.1:34906                  66.240.236.117:50780                  users:(("free-downloads",pid=2015,fd=3))                 
LISTEN 0      128                    [::]:ssh                              [::]:*                                                                               
LISTEN 0      2                         *:ms-wbt-server                       *:*                                                                               
LISTEN 0      2                     [::1]:3350                             [::]:*                                                                               
ESTAB  0      0      [::ffff:192.168.6.1]:ms-wbt-server  [::ffff:192.168.6.254]:57490                                                                           
```

Use `ss -atp` to find listeninig sockets and their processes.
	
1. _What is the IP of the C&C server?_

66.240.236.117

2. _To what port is the malware connecting to on the C&C server?_

50780