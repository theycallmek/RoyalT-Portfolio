# Deploying to the home server

Target: Ubuntu Server (amd64) with Docker and Tailscale already installed. Two containers run under Docker Compose:

- `web`: Caddy serving the built Astro site on `127.0.0.1:8080` (localhost only) and proxying `/api/*` to `stats`.
- `stats`: the Node stats service (GitHub + YouTube + homelab), not published except the homelab ingest port 8788 on `INGEST_BIND` (section 9). Its last-good caches live in the named volume `stats-data`.

Tailscale Funnel terminates TLS and publishes `localhost:8080` on the internet as `https://<machine>.collie-truck.ts.net`.

Replace `<machine>` everywhere below with the server's Tailscale machine name (`tailscale status --self` or `hostname`).

## 1. Prerequisites (one-time)

```bash
docker --version && docker compose version   # Compose v2 plugin ("docker compose", not "docker-compose")
tailscale version && tailscale status
```

If `docker compose` is missing, install the plugin: `sudo apt update && sudo apt install docker-compose-plugin` (from Docker's apt repo).
To run docker without `sudo`: `sudo usermod -aG docker $USER`, then log out and back in. Otherwise prefix the `docker` commands below with `sudo`.

Funnel must be allowed for this machine in the tailnet (HTTPS certificates on and the `funnel` node attribute in the tailnet policy). The first `tailscale funnel` run prints a link to enable it if it is not.

## 2. Get the code

Option A, git (if the repo has a remote or you can reach the dev machine over SSH):

```bash
git clone <repo-url-or-ssh-path> ~/portfolio
cd ~/portfolio
```

Option B, copy the folder from the dev machine (run on the dev machine; excludes the build output, dependencies and the local `.env`):

```bash
rsync -av --exclude node_modules --exclude dist --exclude .astro --exclude .env \
  --exclude server/data --exclude 'makerworld-sample*.html' \
  ./ <user>@<machine>:~/portfolio/
```

Or with `scp -r` from a copy of the folder that does not contain `node_modules` or `.env`. The image builds install their own dependencies, so `node_modules` is never needed on the server.

## 3. Create `.env` (on the server)

```bash
cd ~/portfolio
cp .env.example .env
chmod 600 .env
nano .env
```

Set:

```
SITE_URL=https://<machine>.collie-truck.ts.net
WEB_PORT=8080
YOUTUBE_API_KEY=<the YouTube Data API v3 key>
YOUTUBE_CHANNEL_ID=UC4aCKFHOXtL0WdT3nkMSmrA
GITHUB_USER=theycallmek
GITHUB_TOKEN=            # optional
```

Compose reads `.env` from the project folder automatically. The key is passed to the `stats` container at runtime and is never baked into an image (`.env` is in `.dockerignore`). `SITE_URL` is used at build time (canonical links, sitemap, robots.txt), so a change to it needs a rebuild (step 7).

## 4. Build and start

```bash
docker compose up -d --build
docker compose ps            # stats should become "healthy"
curl -s localhost:8080/api/health          # -> ok
curl -s -o /dev/null -w '%{http_code}\n' localhost:8080/   # -> 200
```

The first build takes a few minutes (npm ci + Astro build). Both containers use `restart: unless-stopped`, so they come back after a reboot as long as the Docker service is enabled (`sudo systemctl enable docker`).

## 5. Publish with Tailscale Funnel

```bash
sudo tailscale funnel --bg 8080
tailscale funnel status
```

`--bg` keeps the funnel configured across reboots and Tailscale restarts. Check from a device that is not on the tailnet (e.g. a phone on mobile data): `https://<machine>.collie-truck.ts.net`.

To stop publishing: `sudo tailscale funnel --https=443 off` (or `sudo tailscale funnel reset` to clear all serve/funnel config).

## 6. Logs and status

```bash
docker compose ps
docker compose logs -f            # both services
docker compose logs -f stats      # "github refresh failed" / "youtube refresh failed" lines show API problems
```

## 7. Update the site

```bash
cd ~/portfolio
git pull                          # or rsync again from the dev machine (step 2, option B)
docker compose up -d --build
docker image prune -f             # optional: remove old dangling images
```

The `stats-data` volume (GitHub/YouTube caches) survives rebuilds.

## 8. Refresh MakerWorld data

MakerWorld blocks automated browsers, so this happens on a dev machine with a normal browser:

1. Open https://makerworld.com/en/@RoyalT/upload, save it (Ctrl+S, "Webpage, HTML Only") as `makerworld-sample.html` in the repo root.
2. `npm run makerworld:import`
3. Commit `src/data/makerworld.json` and `src/assets/makerworld/`.
4. On the server: step 7 (pull or copy, then `docker compose up -d --build`).

## 9. Homelab stats (optional)

The `#homelab` section shows anonymized live stats (uptime, CPU/memory/disk, temperature, network) for the three machines. Each machine runs a tiny agent (`homelab/agent.sh`, a systemd timer every 60 s) that POSTs to the `stats` container's ingest port 8788. Caddy does not proxy it and Funnel does not publish it: it is reachable only on the tailnet. Without `HOMELAB_NODES` the section shows "Homelab stats unavailable" and nothing listens on 8788.

### 9.1 Tokens (on the dev machine or the server, anywhere with Node and the repo)

```bash
npm run homelab:token -- web
npm run homelab:token -- bot
npm run homelab:token -- router
```

Each run prints a **token** (goes only to that machine, step 9.3) and a **`HOMELAB_NODES` entry** (goes in the server `.env`). Nothing is written to disk; tokens are never committed. To revoke or rotate a machine, generate a new token and replace its entry.

### 9.2 Server `.env` (web server)

Add the three entries as one single-quoted JSON array on one line, and the server's Tailscale IPv4 (`tailscale ip -4`):

```
HOMELAB_NODES='[{"id":"web",...},{"id":"bot",...},{"id":"router",...}]'
INGEST_BIND=100.x.y.z
```

Then `docker compose up -d --build` and check: `docker compose logs stats` shows `homelab ingest on 0.0.0.0:8788 (3 nodes)`, and `ss -ltn | grep 8788` shows only the Tailscale IP.

Docker binds `INGEST_BIND` when the container starts; if Tailscale has not assigned its IP yet after a reboot, the stats container fails to start. Allow binding an address before it exists (one-time):

```bash
echo 'net.ipv4.ip_nonlocal_bind=1' | sudo tee /etc/sysctl.d/99-homelab-ingest.conf && sudo sysctl --system
```

### 9.3 Agent (on each of the three machines)

Needs `bash`, `curl` and systemd (`sudo apt install curl` if missing). Copy the `homelab/` folder to the machine (e.g. `scp -r homelab <user>@<machine>:~/`), then:

```bash
cd ~/homelab
./agent.sh --print          # one JSON line with sane values (temp is absent if the board has no sensor)
sudo ./install.sh http://100.x.y.z:8788/ingest     # prompts for this machine's token
```

Use the web server's Tailscale IP (the `INGEST_BIND` value) as the URL on **all three** machines, including the web server itself: the port is published only on that IP, so `127.0.0.1:8788` does not answer. The MagicDNS name (`http://<web-server-name>:8788/ingest`) also works where MagicDNS is enabled.

`install.sh` copies the agent to `/usr/local/lib/homelab-agent/`, the units to `/etc/systemd/system/`, writes `/etc/homelab-agent.env` (root, mode 600; an existing file is kept, delete it to change URL or token) and enables `homelab-agent.timer`.

Check:

```bash
systemctl list-timers homelab-agent.timer
journalctl -u homelab-agent -n 20     # silent on success; curl errors show the HTTP status
```

`401` = wrong token, `429` = more than one report in 20 s (harmless), `400` = invalid values, connection refused/timeout = wrong URL or `INGEST_BIND`. Within a minute the machine appears online on the site (`curl -s localhost:8080/api/stats` on the server). A machine that has not reported for 3 minutes shows "offline · Xm ago" with its last values dimmed.

Uninstall: `sudo systemctl disable --now homelab-agent.timer && sudo rm -r /etc/systemd/system/homelab-agent.* /usr/local/lib/homelab-agent /etc/homelab-agent.env && sudo systemctl daemon-reload`.

### 9.4 OpenWrt router (the Banana Pi)

The router runs OpenWrt (BusyBox `ash`, procd, cron), not Ubuntu, so it uses `install-openwrt.sh` instead of `install.sh`. It installs `bash` with `opkg` if missing, writes `/etc/homelab-agent.env` and adds a cron entry (every minute). Pass `br-wan` as the interface list so NET counts only internet traffic (summing every switch port double counts forwarded traffic). The token is read from stdin:

```bash
# from a machine with the repo; the router's SSH server is Dropbear (keys in /etc/dropbear/authorized_keys)
git archive HEAD homelab | ssh root@<router> 'mkdir -p /tmp/hl && tar -x -C /tmp/hl'
ssh root@<router> 'cd /tmp/hl/homelab && sh ./install-openwrt.sh http://<web-server-tailscale-ip>:8788/ingest br-wan && rm -rf /tmp/hl' < token-file
```

Check: `ssh root@<router> 'set -a; . /etc/homelab-agent.env; /usr/lib/homelab-agent/agent.sh --print'`.

## 10. Stop

```bash
docker compose down        # stops and removes the containers, keeps the cache volume
docker compose down -v     # also deletes the stats-data volume (caches refill on the next start)
sudo tailscale funnel --https=443 off
```

## 11. Custom domain (royalt.online) via Cloudflare Tunnel

Tailscale Funnel only serves `*.ts.net` names, so the public domain goes through a Cloudflare Tunnel: the `cloudflared` container makes an outbound connection to Cloudflare, so no router ports are opened, the home IP stays hidden and HTTPS is handled by Cloudflare. The `ts.net` Funnel address keeps working as a backup. Caddy redirects `www.royalt.online` to `royalt.online`.

1. **Cloudflare account and zone:** sign up at https://dash.cloudflare.com (free), "Add a domain" → `royalt.online` → Free plan. Cloudflare shows two nameservers (e.g. `xxx.ns.cloudflare.com`).
2. **Namecheap nameservers:** Namecheap → Domain List → `royalt.online` → Manage → Nameservers → "Custom DNS" → enter the two Cloudflare nameservers → save. Wait until Cloudflare says the domain is active (minutes to a few hours).
3. **Create the tunnel:** Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create a tunnel → "Cloudflared" → name it `portfolio` → choose Docker as the environment and copy only the token (the long string after `--token`). It is a secret: do not paste it into chats or commit it.
4. **Public hostnames** (tunnel → Public Hostname tab, add two):
   - `royalt.online` → Service type `HTTP`, URL `web:80`
   - `www.royalt.online` → Service type `HTTP`, URL `web:80`
5. **Server `.env`:** add (keep the other lines):
   ```
   SITE_URL=https://royalt.online
   COMPOSE_PROFILES=tunnel
   CLOUDFLARE_TUNNEL_TOKEN=<the token>
   ```
6. **Rebuild** (SITE_URL is baked in at build): `sudo docker compose up -d --build`. `sudo docker compose logs cloudflared` should show "Registered tunnel connection" (four connections).
7. **Cloudflare settings:** SSL/TLS → Edge Certificates → "Always Use HTTPS" on. Leave caching defaults (`/api/*` responses are short-lived JSON and are not cached by default).
8. **Check:** `https://royalt.online` loads, `https://www.royalt.online` redirects to it, and the `ts.net` address still works.


## 12. Private analytics (GoatCounter)

The `goatcounter` service counts page views without cookies (no consent banner). Caddy makes only `/count` and `/count.js` public; the dashboard is published on `INGEST_BIND` (the server's Tailscale IP, as for the homelab ingest), so only devices on your tailnet can open it. The tracking script is included only in builds with an `https://` `SITE_URL`. Visitor countries come from Cloudflare's `CF-Connecting-IP` header; GoatCounter stores no IP addresses.

1. **Start it:** `sudo docker compose up -d --build` (the same command as an update).
2. **Create your account** from a device on your tailnet: open `http://<server-tailscale-ip>:8790` (or `http://<server-tailscale-name>:8790`) and complete the setup form (site domain `royalt.online`, your email and a password). Until this is done `/count.js` redirects to the setup form and nothing is counted.
3. **Don't count yourself:** in the dashboard, Settings → "Ignore IPs" (your home IP), or open `https://royalt.online/#toggle-goatcounter` once in each of your browsers.
4. **Backups:** the data is the `goatcounter-data` volume (SQLite). `docker compose down -v` deletes it.
5. **Nicer dashboard (optional):** the `analytics-dashboard` service serves [goatcounter-dashboard](https://github.com/abhishekhsingh/goatcounter-dashboard) (MIT, pinned commit; its scripts are downloaded at build time with checksums and served locally) on `http://<server-tailscale-name>:8791`, tailnet only. In GoatCounter (port 8790): your name → Settings → API → **Create key** with only **Read statistics** checked. In the dashboard enter `http://<server-tailscale-name>:8791` as the GoatCounter URL (the same address you opened; it proxies `/api/` to GoatCounter) and paste the key. The key stays in that browser's local storage.

## 13. royalt.online on Cloudflare Workers (survives a home outage)

The public site is served by a Cloudflare Worker (`wrangler.jsonc`, `worker/`): the pages come from Workers Static Assets, and `/api/stats` comes from a D1 database that the home stats service pushes to every minute (outbound only). If the home server is down, the site still loads with the last stats; homelab machines show offline after 3 minutes. Analytics go to `count.royalt.online` (tunnel → Caddy → GoatCounter, `/count` and `/count.js` only). GitHub Actions deploys the Worker on every push to `main`. The home server keeps serving its own copy on the Tailscale Funnel address.

One-time setup:
1. **D1 database:** Cloudflare dashboard → Storage & databases → D1 → Create → name `royalt-stats`. Put its ID in `wrangler.jsonc` (`database_id`).
2. **API token:** My Profile → API Tokens → Create token → template "Edit Cloudflare Workers"; add the permission Account → D1 → Edit; zone resources: `royalt.online`.
3. **Push token:** on the server, `openssl rand -hex 32`.
4. **GitHub secrets** (repo → Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (dashboard → Workers & Pages, right column), `STATS_PUSH_TOKEN` (step 3).
5. **Server `.env`:** `STATS_PUSH_URL=https://royalt-online.<your-subdomain>.workers.dev/api/stats` and `STATS_PUSH_TOKEN=` (step 3), then `sudo docker compose up -d --build`.
6. **Tunnel:** add the public hostname `count.royalt.online` → `http://web:80`.
7. **Cutover:** in the tunnel, delete the `royalt.online` public hostname; then Workers & Pages → `royalt-online` → Settings → Domains & Routes → Add → Custom domain `royalt.online`.
8. **www:** Rules → Redirect Rules → template "Redirect from WWW to root" (301, keep the query string), so www works during an outage too.
