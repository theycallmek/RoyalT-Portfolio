#!/usr/bin/env bash
# Installs the homelab agent as a systemd timer. Run as root from this folder:
#   sudo ./install.sh <ingest-url>            (prompts for the token, keeps it out of shell history)
#   sudo ./install.sh <ingest-url> <token>
# An existing /etc/homelab-agent.env is kept; delete it first to change the URL or token.
set -eu
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
env_file=/etc/homelab-agent.env

if [ ! -e "$env_file" ]; then
  url=${1:-}
  token=${2:-}
  [ -n "$url" ] || { echo "usage: sudo $0 <ingest-url> [token]" >&2; exit 1; }
  if [ -z "$token" ]; then
    read -rsp "Token for this machine: " token
    echo
  fi
  case $token in '' | *[!A-Za-z0-9._~+/=-]*) echo "invalid token" >&2; exit 1 ;; esac
  (umask 077 && printf 'HOMELAB_URL=%s\nHOMELAB_TOKEN=%s\n' "$url" "$token" >"$env_file")
else
  echo "keeping existing $env_file"
fi
chown root:root "$env_file"
chmod 600 "$env_file"

install -D -m 755 "$here/agent.sh" /usr/local/lib/homelab-agent/agent.sh
install -m 644 "$here/homelab-agent.service" "$here/homelab-agent.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now homelab-agent.timer
systemctl start homelab-agent.service || true # first report now; failures show in journalctl
echo "installed; check with: systemctl status homelab-agent.service; journalctl -u homelab-agent -n 20"
