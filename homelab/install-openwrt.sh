#!/bin/sh
# Installs the homelab agent on OpenWrt (BusyBox ash, procd, cron; no systemd). Run as root from this folder:
#   ./install-openwrt.sh <ingest-url> [interfaces]     (reads the token from stdin)
# interfaces: optional space-separated list of interfaces to count for NET, e.g. "br-wan" (the WAN only;
# summing every port on a router counts forwarded traffic two or three times).
# Needs bash for the agent (installed with opkg if missing) and curl.
# An existing /etc/homelab-agent.env is kept; delete it first to change the URL, token or interfaces.
set -eu
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
env_file=/etc/homelab-agent.env
lib=/usr/lib/homelab-agent

command -v bash >/dev/null || { opkg update >/dev/null && opkg install bash; }
command -v curl >/dev/null || { opkg update >/dev/null && opkg install curl; }

if [ ! -e "$env_file" ]; then
  url=${1:-}
  ifaces=${2:-}
  [ -n "$url" ] || { echo "usage: $0 <ingest-url> [interfaces] < token" >&2; exit 1; }
  IFS= read -r token || true
  case $token in '' | *[!A-Za-z0-9._~+/=-]*) echo "invalid or missing token on stdin" >&2; exit 1 ;; esac
  (umask 077 && printf 'HOMELAB_URL=%s\nHOMELAB_TOKEN=%s\nHOMELAB_IFACES="%s"\n' "$url" "$token" "$ifaces" >"$env_file")
else
  echo "keeping existing $env_file"
fi
chmod 600 "$env_file"

mkdir -p "$lib"
cp "$here/agent.sh" "$lib/agent.sh"
chmod 755 "$lib/agent.sh"

line="* * * * * set -a; . $env_file; set +a; $lib/agent.sh >/dev/null 2>&1"
touch /etc/crontabs/root
grep -vF "$lib/agent.sh" /etc/crontabs/root >/etc/crontabs/root.new || true
echo "$line" >>/etc/crontabs/root.new
mv /etc/crontabs/root.new /etc/crontabs/root
/etc/init.d/cron enable
/etc/init.d/cron restart

# first report now
# shellcheck source=/dev/null
( set -a; . "$env_file"; set +a; "$lib/agent.sh" ) && echo "installed; first report sent (cron runs it every minute)"
