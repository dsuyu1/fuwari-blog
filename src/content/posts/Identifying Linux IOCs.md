---
title: "Identifying Linux IOCs"
published: 2026-1-22T00:00:00-08:00
tags: [Rangeforce, Incident Response]
category: Cybersecurity
draft: true
---

1. use htop
2. sudo netstat -tulp 
3. ps aux | grep 440

PID is 230 because 

![Htop](public/rangeforce_linux_forensics.png)

	
What is the PID of the persistence process?

230
Correct	
What is the full path of the persistence script?

/etc/rc.local
Correct	
What is the IP address of the C2 server?

5.196.8.171

## Malware Cleanup

```bash
rm: remove write-protected regular file 'rc.local'? yes
rm: cannot remove 'rc.local': Permission denied
student@server:/etc$ sudo rm rc.local
student@server:/etc$ sudo kill 

Usage:
 kill [options] <pid> [...]

Options:
 <pid> [...]            send signal to every <pid> listed
 -<signal>, -s, --signal <signal>
                        specify the <signal> to be sent
 -l, --list=[<signal>]  list all signal names, or convert one to a name
 -L, --table            list all signal names in a nice table

 -h, --help     display this help and exit
 -V, --version  output version information and exit

For more details see kill(1).
student@server:/etc$ sudo kill 441
student@server:/etc$ htop
student@server:/etc$ sudo kill 230
kill: (230): No such process
student@server:/etc$ rm rf /usr/share/.xmrabbit
rm: cannot remove 'rf': No such file or directory
rm: cannot remove '/usr/share/.xmrabbit': Is a directory
student@server:/etc$ rm -rf /usr/share/.xmrabbit
rm: cannot remove '/usr/share/.xmrabbit/xmrig': Permission denied
rm: cannot remove '/usr/share/.xmrabbit/config.json': Permission denied
student@server:/etc$ sudo rm -rf /usr/share/.xmrabbit
student@server:/etc$ rm -rf /tmp/.junk
rm: cannot remove '/tmp/.junk/bbac0ed1': Permission denied
student@server:/etc$ sudo rm -rf /tmp/.junk
student@server:/etc$ cd /tmp
student@server:/tmp$ ls
systemd-private-019644c7099d4ef79fc4f5dc66d9718b-haveged.service-dh8muR
systemd-private-019644c7099d4ef79fc4f5dc66d9718b-systemd-timesyncd.service-1mC7tF
student@server:/tmp$ htop
student@server:/tmp$ sudo kill 440
student@server:/tmp$ htop
student@server:/tmp$ 

```
