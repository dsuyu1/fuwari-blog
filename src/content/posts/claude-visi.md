---
title: "Claude Audited My SOC Lab — It Was Not Happy"
published: 2026-4-5T00:00:00-08:00
tags: [AI, Docker, Keycloak, VISI]
description: "I asked Claude to audit the VISI SOC lab environment, and it found some questionable things."
category: Cybersecurity
draft: true
image: /claude_auditor.png
---

# Introduction

I've been having problems with my SOC lab recently, so I put Claude Code on the Raspberry Pi 5 on which everything is hosted and asked it to audit my environment.

Here was the prompt:

> Hello Claude! You're going to help me audit and fix my SOC lab environment. I have a few folders related to my Docker containers that host it, along with some other components. Users are having trouble logging in, and I think most of the issues are related to Keycloak — it's causing failures to log in via SSO and other authentication-related problems. Anyway, that's for another time. Audit my environment and let me know where I can fix things.

# Audit Report

The following findings were generated from Claude's audit report.

## Architecture Summary

- **`visi-lab/wazuh-docker/single-node`** — Keycloak + Postgres + Wazuh (manager, indexer, dashboard)
- **`visi-lab-portal`** — nginx + oauth2-proxy → lab.vaqueroisi.org
- **`thehive-docker`** — prod1 & prod2 TheHive/Cortex stacks + a testing stack

  
## Critical Issues (Auth / Keycloak)

1. **Keycloak is running in `start-dev` mode**

   - **File**: `visi-lab/wazuh-docker/single-node/docker-compose.yml:11`
   - **command**: `start-dev`

   `start-dev` is explicitly for development. In this mode Keycloak disables caches, uses relaxed security, and is known to cause session instability and OIDC validation failures in production. This should be `start`.

   For production mode you also need to explicitly set the hostname:

   ```yaml frame="code" title="Keycloak production configuration"
   command: start
   environment:
   - KC_HOSTNAME=auth.vaqueroisi.org
   - KC_HTTP_ENABLED=true          # allow HTTP from Cloudflare tunnel
   - KC_PROXY_HEADERS=xforwarded   # already set
   - KC_HOSTNAME_STRICT=false      # keep if needed
   ```

2. **No `KC_HOSTNAME` set**

   Without `KC_HOSTNAME`, Keycloak derives its frontend URL from the request. Behind a Cloudflare Tunnel this can be inconsistent — the `iss` (issuer) claim in JWTs may not match `https://auth.vaqueroisi.org/realms/visi-lab`, causing oauth2-proxy and the Wazuh dashboard OIDC validation to reject tokens with an issuer mismatch error.

3. **Wazuh OIDC missing logout URL**

   - **File**: `visi-lab/wazuh-docker/single-node/config/wazuh_dashboard/opensearch_dashboards.yml:21`

   There's no `opensearch_security.openid.logout_url` configured. Without it, signing out of Wazuh dashboard won't end the Keycloak session, and users can get into auth loops.

   Add:

   ```yaml frame="code" title="Wazuh OIDC logout configuration"
   opensearch_security.openid.logout_url: "https://auth.vaqueroisi.org/realms/visi-lab/protocol/openid-connect/logout?redirect_uri=https%3A%2F%2Fwazuh.vaqueroisi.org"
   ```

  
## Security Issues

4. **Default Wazuh credentials not changed**

   - **File**: `single-node/docker-compose.yml`

   ```bash frame="code" title="Default Wazuh credentials"
   INDEXER_PASSWORD=SecretPassword    # ← Wazuh default, widely known
   DASHBOARD_PASSWORD=kibanaserver    # ← Wazuh default, widely known
   ```

   These are the official sample defaults. Anyone who knows Wazuh can authenticate to your indexer.

5. **Keycloak admin and DB share the same weak password**

   ```bash frame="code" title="Shared weak passwords"
   KEYCLOAK_ADMIN_PASSWORD=keycloakfeb86$
   KC_DB_PASSWORD=keycloakfeb86$
   POSTGRES_PASSWORD=keycloakfeb86$
   ```

   All three are the same value. A compromise of any one of them compromises everything. Also, secrets are hardcoded directly in `docker-compose.yml` rather than sourced from an `.env` file.

6. **Secrets committed in plaintext .env files**

   - `visi-lab-portal/.env` — `OAUTH2_CLIENT_SECRET`, `COOKIE_SECRET`
   - `thehive-docker/testing/.env` — `elasticsearch_password`, `play.http.secret.key` (via secret.conf)

   Check that `.gitignore` excludes `.env` files from commits.

7. **Cortex trusts all proxies**

   - **File**: `prod1-cortex/cortex/config/application.conf:14` and `prod2-cortex/...`

   ```frame="code" title="Overly permissive proxy trust"
   play.http.forwarded.trustedProxies=["0.0.0.0/0", "::/0"]
   ```

   This trusts any `X-Forwarded-For` header, enabling IP spoofing. Scope it to your nginx container's subnet instead (e.g. `172.0.0.0/8` or the specific Docker bridge).

8. **Cortex session/CSRF cookies not secured in prod**

   - **Files**: both prod cortex `application.conf`

   ```frame="code" title="Insecure cookie settings"
   play.http.session.secure = false
   play.filters.csrf.cookie.secure = false
   ```

   Since Cortex is behind an nginx TLS terminator, these should be `true` in production.

9. **Wazuh internal_users.yml uses demo account hashes**

   - **File**: `single-node/config/wazuh_indexer/internal_users.yml`

   All users (`kibanaro`, `logstash`, `readall`, `snapshotrestore`) have the default demo bcrypt hashes from the Wazuh sample config. These need to be regenerated.

  
## Configuration Bugs

10. **Cassandra heap misconfiguration in testing**

    - **File**: `thehive-docker/testing/docker-compose.yml:12-13`

    ```yaml frame="code" title="Incorrect heap configuration"
    - HEAP_NEWSIZE=1280M
    - MAX_HEAP_SIZE=200M
    ```

    `HEAP_NEWSIZE` must be less than `MAX_HEAP_SIZE` (it sets young generation heap, which must fit inside the max). This is inverted — Cassandra will likely fail to start or OOM. Should be something like `HEAP_NEWSIZE=200M` / `MAX_HEAP_SIZE=1280M`.

11. **Duplicate UID/GID definitions in testing .env**

    - **File**: `thehive-docker/testing/.env`

    `UID=XXXX` and `GID=XXXX` placeholders appear at the top but are overridden by the correct `UID=1000`/`GID=1000` added later by `init.sh`. The placeholders should be removed to avoid confusion.

12. **play.http.context inconsistency**

    - prod1/prod2 TheHive: `play.http.context : "/"`
    - testing TheHive: `play.http.context : "/thehive"`
    - The lab portal links to `https://hive.vaqueroisi.org/thehive`

    If prod TheHive uses `/`, the `/thehive` path in the dashboard link will 404 unless nginx rewrites it. Double-check the nginx template strips the prefix.

13. **nginx_ssl_trusted_certificate="" in testing**

    - **File**: `thehive-docker/testing/.env:26`

    An empty SSL trusted certificate string will cause nginx to fail rendering its template if it tries to reference the variable. Verify the nginx template handles an empty value gracefully.

14. **Prod stacks have no .env files — only templates**

    `prod1-thehive`, `prod2-thehive`, `prod1-cortex`, `prod2-cortex` all only have `dot.env.template` with `###CHANGEME###` placeholders. If these stacks are supposed to be running, the actual `.env` files need to exist with real values (elasticsearch password, UID/GID, nginx server name).

15. **prod2-cortex label says environment: "testing"**

    - **File**: `thehive-docker/prod2-cortex/docker-compose.yml:43,95`

    Cosmetic but misleading — the prod2 Cortex containers are labeled as testing environment.


## Summary Priority List

:::warning
**P0 issues are critical and should be addressed immediately** as they affect authentication and security.
:::

| Priority | Issue |
|----------|-------|
| **P0** | Keycloak `start-dev` → switch to `start` + set `KC_HOSTNAME` |
| **P0** | Default Wazuh `SecretPassword` / `kibanaserver` credentials |
| **P1** | Add `KC_HOSTNAME=auth.vaqueroisi.org` to fix OIDC issuer mismatch |
| **P1** | Add Wazuh dashboard OIDC logout URL |
| **P1** | Cassandra heap inversion in testing (will crash) |
| **P2** | Rotate Keycloak/Postgres passwords, stop reusing them |
| **P2** | Cortex: set `play.http.session.secure = true` in prod, narrow trusted proxies |
| **P3** | Regenerate Wazuh `internal_users.yml` hashes |
| **P3** | Fix testing `.env` duplicate UID/GID placeholders |
| **P3** | Verify prod `.env` files exist before starting prod stacks |

---

# Issue 1: Weak/insecure Passwords, `start-dev` Issue
We're going to tackle each issue in order of descending priority.


![Fixing the start-dev issue](/p0-1.png)

We can also see the weak `KEYCLOAK_ADMIN_PASSWORD` and `KC_DB_PASSWORD`. Later on in the file we also see the default Wazuh credentials. I will also replace those with environment variables. After all the changes have been made, we can see our `docker-compose.yml` file looks like this now.

```yml title="docker-compose.yml"
# Wazuh App Copyright (C) 2017, Wazuh Inc. (License GPLv2)
# Modified: Added Keycloak + Postgres for VISI-Lab SSO
services:

  # --- KEYCLOAK (Identity Provider) ---
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    container_name: visi-keycloak
    hostname: keycloak
    restart: always
    command: start
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD}
      - KC_DB=postgres
      - KC_DB_URL=jdbc:postgresql://postgres/keycloak
      - KC_DB_USERNAME=keycloak
      - KC_DB_PASSWORD=${KC_DB_PASSWORD}
      - KC_PROXY_HEADERS=xforwarded # Needed. behind Cloudflare Tunnel
      - KC_HOSTNAME_STRICT=false
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    deploy:
      resources:
        limits:
          memory: 1.5G

  postgres:
    image: postgres:15
    container_name: visi-postgres
    hostname: postgres
    restart: always
    environment:
      - POSTGRES_DB=keycloak
      - POSTGRES_USER=keycloak
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 1G

  # --- WAZUH (SIEM) - Official single-node config ---
  wazuh.manager:
    image: wazuh/wazuh-manager:4.14.3
    hostname: wazuh.manager
    restart: always
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 655360
        hard: 655360
    ports:
      - "1514:1514"
      - "1515:1515"
      - "514:514/udp"
      - "55000:55000"
    environment:
      - INDEXER_URL=https://wazuh.indexer:9200
      - INDEXER_USERNAME=admin
      - INDEXER_PASSWORD=${INDEXER_PASSWORD}
      - FILEBEAT_SSL_VERIFICATION_MODE=full
      - SSL_CERTIFICATE_AUTHORITIES=/etc/ssl/root-ca.pem
      - SSL_CERTIFICATE=/etc/ssl/filebeat.pem
      - SSL_KEY=/etc/ssl/filebeat.key
      - API_USERNAME=wazuh-wui
      - API_PASSWORD=${API_PASSWORD}
    volumes:
      - wazuh_api_configuration:/var/ossec/api/configuration
      - wazuh_etc:/var/ossec/etc
      - wazuh_logs:/var/ossec/logs
      - wazuh_queue:/var/ossec/queue
      - wazuh_var_multigroups:/var/ossec/var/multigroups
      - wazuh_integrations:/var/ossec/integrations
      - wazuh_active_response:/var/ossec/active-response/bin
      - wazuh_agentless:/var/ossec/agentless
      - wazuh_wodles:/var/ossec/wodles
      - filebeat_etc:/etc/filebeat
      - filebeat_var:/var/lib/filebeat
      - ./config/wazuh_indexer_ssl_certs/root-ca-manager.pem:/etc/ssl/root-ca.pem
      - ./config/wazuh_indexer_ssl_certs/wazuh.manager.pem:/etc/ssl/filebeat.pem
      - ./config/wazuh_indexer_ssl_certs/wazuh.manager-key.pem:/etc/ssl/filebeat.key
      - ./config/wazuh_cluster/wazuh_manager.conf:/wazuh-config-mount/etc/ossec.conf

  wazuh.indexer:
    image: wazuh/wazuh-indexer:4.14.3
    hostname: wazuh.indexer
    restart: always
    ports:
      - "9200:9200"
    environment:
      - "OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g"
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    volumes:
      - wazuh-indexer-data:/var/lib/wazuh-indexer
      - ./config/wazuh_indexer_ssl_certs/root-ca.pem:/usr/share/wazuh-indexer/config/certs/root-ca.pem
      - ./config/wazuh_indexer_ssl_certs/wazuh.indexer-key.pem:/usr/share/wazuh-indexer/config/certs/wazuh.indexer.key
      - ./config/wazuh_indexer_ssl_certs/wazuh.indexer.pem:/usr/share/wazuh-indexer/config/certs/wazuh.indexer.pem
      - ./config/wazuh_indexer_ssl_certs/admin.pem:/usr/share/wazuh-indexer/config/certs/admin.pem
      - ./config/wazuh_indexer_ssl_certs/admin-key.pem:/usr/share/wazuh-indexer/config/certs/admin-key.pem
      - ./config/wazuh_indexer/wazuh.indexer.yml:/usr/share/wazuh-indexer/config/opensearch.yml
      - ./config/wazuh_indexer/internal_users.yml:/usr/share/wazuh-indexer/config/opensearch-security/internal_users.yml

  wazuh.dashboard:
    image: wazuh/wazuh-dashboard:4.14.3
    hostname: wazuh.dashboard
    restart: always
    ports:
      - 443:5601
    environment:
      - INDEXER_USERNAME=admin
      - INDEXER_PASSWORD=${INDEXER_PASSWORD}
      - WAZUH_API_URL=https://wazuh.manager
      - DASHBOARD_USERNAME=kibanaserver
      - DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}
      - API_USERNAME=wazuh-wui
      - API_PASSWORD=${API_PASSWORD}
    volumes:
      - ./config/wazuh_indexer_ssl_certs/wazuh.dashboard.pem:/usr/share/wazuh-dashboard/certs/wazuh-dashboard.pem
      - ./config/wazuh_indexer_ssl_certs/wazuh.dashboard-key.pem:/usr/share/wazuh-dashboard/certs/wazuh-dashboard-key.pem
      - ./config/wazuh_indexer_ssl_certs/root-ca.pem:/usr/share/wazuh-dashboard/certs/root-ca.pem
      - ./config/wazuh_dashboard/opensearch_dashboards.yml:/usr/share/wazuh-dashboard/config/opensearch_dashboards.yml
      - ./config/wazuh_dashboard/wazuh.yml:/usr/share/wazuh-dashboard/data/wazuh/config/wazuh.yml
      - wazuh-dashboard-config:/usr/share/wazuh-dashboard/data/wazuh/config
      - wazuh-dashboard-custom:/usr/share/wazuh-dashboard/plugins/wazuh/public/assets/custom
    depends_on:
      - wazuh.indexer
    links:
      - wazuh.indexer:wazuh.indexer
      - wazuh.manager:wazuh.manager

volumes:
  # Keycloak
  postgres_data:
  # Wazuh Manager
  wazuh_api_configuration:
  wazuh_etc:
  wazuh_logs:
  wazuh_queue:
  wazuh_var_multigroups:
  wazuh_integrations:
  wazuh_active_response:
  wazuh_agentless:
  wazuh_wodles:
  filebeat_etc:
  filebeat_var:
  # Wazuh Indexer
  wazuh-indexer-data:
  # Wazuh Dashboard
  wazuh-dashboard-config:
  wazuh-dashboard-custom:
```

And our `.env` file has passwords that I generated running this command:

```
for i in {1..6}; do:
   echo "Password: $i: $(openssl rand -base64 32)"
done
```

Checklist:

- [x] Keycloak start-dev → switch to start + set KC_HOSTNAME
- [x] Default Wazuh SecretPassword / kibanaserver credentials
- [x] Rotate Keycloak/Postgres passwords, stop reusing them
- [ ] Add KC_HOSTNAME=auth.vaqueroisi.org to fix OIDC issuer mismatch
- [ ] Add Wazuh dashboard OIDC logout URL
- [ ] Cassandra heap inversion in testing (will crash)
- [ ] Cortex: set `play.http.session.secure` and `play.filters.csrf.cookie.secure` = true in prod, narrow trusted proxies
- [ ] Fix testing .env duplicate UID/GID placeholders
- [ ] Verify prod .env files exist before starting prod stacks

## Issue 2: No `KC_HOSTNAME` set
We could have done this in the previous step as well, but oh well - let's do it now.

![Adding KC_HOSTNAME](/p1-1.png)

The `KC_HOSTNAME` is just where I go to log into the admin panel to make configurations from within the GUI.

Checklist:

- [x] Keycloak start-dev → switch to start + set KC_HOSTNAME
- [x] Default Wazuh SecretPassword / kibanaserver credentials
- [x] Rotate Keycloak/Postgres passwords, stop reusing them
- [x] Add KC_HOSTNAME=auth.vaqueroisi.org to fix OIDC issuer mismatch
- [ ] Add Wazuh dashboard OIDC logout URL
- [ ] Cassandra heap inversion in testing (will crash)
- [ ] Cortex: set `play.http.session.secure` and `play.filters.csrf.cookie.secure` = `true` in prod, narrow trusted proxies
- [ ] Fix testing .env duplicate UID/GID placeholders
- [ ] Verify prod .env files exist before starting prod stacks

## Issue 3: Wazuh OIDC missing logout URL

![Wazuh dashboard OIDC Fix](/wazuh_logout_fix.png)

Again, this line sets up OpenID Connect (OIDC) logout behavior. It redirects to `https://wazuh.vaqueroisi.org`

Checklist:

- [x] Keycloak start-dev → switch to start + set KC_HOSTNAME
- [x] Default Wazuh SecretPassword / kibanaserver credentials
- [x] Rotate Keycloak/Postgres passwords, stop reusing them
- [x] Add KC_HOSTNAME=auth.vaqueroisi.org to fix OIDC issuer mismatch
- [x] Add Wazuh dashboard OIDC logout URL
- [ ] Cassandra heap inversion in testing (will crash)
- [ ] Cortex: set `play.http.session.secure` and `play.filters.csrf.cookie.secure` = `true` in prod, narrow trusted proxies
- [ ] Fix testing .env duplicate UID/GID placeholders
- [ ] Verify prod .env files exist before starting prod stacks

## Issue 4: Cassandra heap misconfiguration in testing

![Fixing the Cassandra heap size](/cassandra.png)

**Cassandra** heap size is the amount of JVM memory allocated to the database (`MAX_HEAP_SIZE`) for operations like managing memtables and reading data. According to [accepted guidelines and recommendations](https://docs.datastax.com/en/dse/6.9/managing/operations/change-heap-size.html), heap size is usually 1/4 and 1/2 of system memory, but no larger than 32 GB.

Checklist:

- [x] Keycloak start-dev → switch to start + set KC_HOSTNAME
- [x] Default Wazuh SecretPassword / kibanaserver credentials
- [x] Rotate Keycloak/Postgres passwords, stop reusing them
- [x] Add KC_HOSTNAME=auth.vaqueroisi.org to fix OIDC issuer mismatch
- [x] Add Wazuh dashboard OIDC logout URL
- [x] Cassandra heap inversion in testing (will crash)
- [ ] Cortex: set `play.http.session.secure` and `play.filters.csrf.cookie.secure` = `true` in prod, narrow trusted proxies
- [ ] Fix testing .env duplicate UID/GID placeholders
- [ ] Verify prod .env files exist before starting prod stacks

## Issue 5: Cortex proxy settings
**[Cortex](https://strangebee.com/cortex/)** is the "brain" of TheHive. It's open-source, and it solves two common problems frequently encountered by SOCs, CSIRTs and security researchers in the course of threat intelligence, digital forensics and incident response:
- How to analyze observables they have collected, at scale, by querying a single tool instead of several?
- How to actively respond to threats and interact with the constituency and other teams?

Let's set the scope of the proxy to trust our `nginx` container's subnet. We can find this using `docker ps`.

![nginx and cortex proxy](/nginx.png)

We can see that our containers are listening locally. Let's set the proxy to accept connects from our local subnet.

![Cortex fix](/cortex_fix.png)

We need to do this for both `prod1-cortex` and `prod2-cortex`.

We also need to fix our CSRF cookie settings. In the same file, I'll set `play.http.session.secure` and `play.filters.csrf.cookie.secure` to `true`.

[Cross-site request forgery (CSRF)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF) cookies are security mechanisms used to prevent unauthorized commands from being executed on a web application where a user is authenticated. The way it works is that the cookie stores a unique, secret token that the server verifies against a corresponding token in HTTP requests (like POST) to ensure that the request is legitimate and wasn't forged by a malicious site.

Checklist:

- [x] Keycloak start-dev → switch to start + set KC_HOSTNAME
- [x] Default Wazuh SecretPassword / kibanaserver credentials
- [x] Rotate Keycloak/Postgres passwords, stop reusing them
- [x] Add KC_HOSTNAME=auth.vaqueroisi.org to fix OIDC issuer mismatch
- [x] Add Wazuh dashboard OIDC logout URL
- [x] Cassandra heap inversion in testing (will crash)
- [x] Cortex: set `play.http.session.secure` and `play.filters.csrf.cookie.secure` = `true` in prod, narrow trusted proxies
- [ ] Fix testing .env duplicate UID/GID placeholders
- [ ] Verify prod .env files exist before starting prod stacks

## Issue 6: Wazuh internal_users.yml uses demo account hashes
`bcrypt` hashes are used to compare if your password produces a match. If it does, you're authenticated! If an attacker was able to steal our `internal_users.yml` file, they wouldn't get any passwords - just `bcrypt` hashes.

The best way to regenerate the hashes is to use Wazuh's built-in tools

![Rotating Wazh's default hashes](/rotating_wazuh_hashes.png)

1. Find the indexer's container name. The script `plugin/tools/hash.sh` lives _inside_ the container, so we'll need to `docker exec` into it.
2. Run the follow command:
```bash
# command to remote into a Docker  container
docker exec -it <your_indexer_container_name> env OPENSEARCH_JAVA_HOME=/usr/share/wazuh-indexer/jdk /usr/share/wazuh-indexer/plugins/opensearch-security/tools/hash.sh -p 'YourStrongPasswordHere'
```
3. You should see a hash outputted in the terminal. Repeat for all users (`admin`, `kibanaserver`, `kibanaro`, etc.)

## Issue 7 & Configuration Bugs
![default_system_variables](/default_system_variables.png)

Let's delete these placeholders. 

Now that we've gone and verified the most critical issues have been remediated, I'll use Claude to clean up the small configuration issues and inconsistencies.

![Prompt and output](/claude_configuration_help.png)

![Final output](/claude_code_output.png)

![Empty SSL certificate issues](/empty_ssl_certificate.png)

# Conclusion
It goes without saying, but AI is an amazing accelerator for engineering and architecting. Claude's audit moved the VISI SOC lab from poorly-made to much more resilient. We closed the most critical authentication and configuration gaps and restored reliable SSO behavior. We can use AI to accelerate discovery and suggest fixes, but always validate changes with testing, and—when possible—a targeted _penetration test_ before declaring systems production-ready.

Speaking of penetration testing—that's the next step! In the next post, I'll be demonstrating how to conduct a rudimentary penetration test against my own environment!