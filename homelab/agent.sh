#!/usr/bin/env bash
# Homelab stats agent: reads /proc and /sys, POSTs one small JSON report to the stats service.
# Needs bash, coreutils (df) and curl. Config (env): HOMELAB_URL, HOMELAB_TOKEN, optional
# HOMELAB_IFACES (only count these interfaces, e.g. "br-wan" on the OpenWrt router).
# Usage: agent.sh            send a report
#        agent.sh --print    print the JSON instead (no config needed)
set -eu
export LC_ALL=C

cpu_sample() { # prints "total idle" jiffies from the aggregate cpu line
  local _cpu user nice sys idle iowait irq softirq steal _rest
  read -r _cpu user nice sys idle iowait irq softirq steal _rest </proc/stat
  echo "$((user + nice + sys + idle + iowait + irq + softirq + ${steal:-0})) $((idle + iowait))"
}

net_sample() { # prints "rx tx" bytes summed over physical interfaces
  local line name vals rx=0 tx=0 r t _
  while IFS= read -r line; do
    case $line in *:*) ;; *) continue ;; esac # skip the two header lines
    name=${line%%:*}
    name=${name##* }
    if [ -n "${HOMELAB_IFACES:-}" ]; then
      # explicit list (space separated), e.g. a router's WAN only: forwarded traffic is not double counted
      case " $HOMELAB_IFACES " in *" $name "*) ;; *) continue ;; esac
    else
      case $name in lo | tailscale* | docker* | br-* | veth* | virbr* | wg*) continue ;; esac
    fi
    vals=${line#*:}
    read -r r _ _ _ _ _ _ _ t _ <<<"$vals"
    rx=$((rx + r))
    tx=$((tx + t))
  done </proc/net/dev
  echo "$rx $tx"
}

read -r c1_total c1_idle <<<"$(cpu_sample)"
read -r n1_rx n1_tx <<<"$(net_sample)"
sleep 1
read -r c2_total c2_idle <<<"$(cpu_sample)"
read -r n2_rx n2_tx <<<"$(net_sample)"

dt=$((c2_total - c1_total))
di=$((c2_idle - c1_idle))
cpu=0
[ "$dt" -gt 0 ] && cpu=$(((100 * (dt - di) + dt / 2) / dt))
[ "$cpu" -lt 0 ] && cpu=0
[ "$cpu" -gt 100 ] && cpu=100

rx=$((n2_rx - n1_rx))
tx=$((n2_tx - n1_tx))
[ "$rx" -lt 0 ] && rx=0 # counter reset or interface change between samples
[ "$tx" -lt 0 ] && tx=0

read -r uptime _ </proc/uptime
uptime=${uptime%.*}

mem_total='' mem_avail=''
while read -r key value _; do
  case $key in
    MemTotal:) mem_total=$value ;;
    MemAvailable:) mem_avail=$value ;;
  esac
done </proc/meminfo
mem_used=$((mem_total - mem_avail)) # kB

disk=$(df -P / | { read -r _ && read -r _ _ _ _ pct _ && echo "${pct%\%}"; })

# Highest sensor reading in millidegrees; sensors that are missing, unreadable or nonsensical are skipped.
temp_max=''
for f in /sys/class/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp*_input; do
  [ -r "$f" ] || continue
  v=''
  read -r v <"$f" 2>/dev/null || true
  case $v in '' | *[!0-9]*) continue ;; esac
  [ "$v" -gt 0 ] && [ "$v" -lt 150000 ] || continue
  if [ -z "$temp_max" ] || [ "$v" -gt "$temp_max" ]; then temp_max=$v; fi
done

case $(uname -m) in
  x86_64 | i?86) arch=x86 ;;
  aarch64 | arm*) arch=ARM ;;
  *) arch=unknown ;; # the service rejects it; better than a wrong class
esac

temp_json=''
[ -n "$temp_max" ] && temp_json=",\"temp\":$(((temp_max + 500) / 1000))"
json="{\"uptimeSeconds\":$uptime,\"cpu\":$cpu,\"memUsed\":$mem_used,\"memTotal\":$mem_total,\"disk\":$disk$temp_json,\"rx\":$rx,\"tx\":$tx,\"arch\":\"$arch\"}"

if [ "${1:-}" = "--print" ]; then
  echo "$json"
  exit 0
fi

: "${HOMELAB_URL:?HOMELAB_URL not set}"
: "${HOMELAB_TOKEN:?HOMELAB_TOKEN not set}"
# Token via curl's config on stdin, not argv (other users can read /proc/*/cmdline).
printf 'header = "Authorization: Bearer %s"\n' "$HOMELAB_TOKEN" |
  curl -fsS --max-time 10 -K - -H 'Content-Type: application/json' --data-binary "$json" "$HOMELAB_URL"
