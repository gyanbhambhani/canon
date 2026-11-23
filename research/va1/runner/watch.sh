#!/bin/sh
# Prints a line every 15 recorded Qwen runs, and when the runner exits.
cd "$(dirname "$0")/.."
last=0
while true; do
  c=$(grep -c '^PASS\|^FAIL' .work-qwen.log)
  if [ "$c" != "$last" ] && [ $((c % 15)) -eq 0 ]; then echo "runs recorded: $c"; last=$c; fi
  pgrep -f "runner/run.ts" >/dev/null || { echo "runner exited after $c runs"; break; }
  sleep 60
done
