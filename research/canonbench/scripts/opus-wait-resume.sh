#!/bin/sh
# Probe claude-opus-5-5 every 10 minutes until 06:30 PST; when a call succeeds, resume its main run.
cd "$(dirname "$0")/.." || exit 1
while [ "$(date +%H%M)" -lt 0630 ] || [ "$(date +%H)" -gt 12 ]; do
  if npx tsx --conditions=source scripts/opus-probe.ts; then
    echo "RESUMING opus $(date)"
    scripts/main-api.sh opus
    exit 0
  fi
  sleep 600
done
echo "GAVE UP on opus $(date)"
