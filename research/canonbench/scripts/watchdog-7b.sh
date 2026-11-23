#!/bin/sh
# Keeps the Qwen 7B main run alive: if the MLX server's generation thread dies (Metal out of
# memory), stop the runner, restart the server on port 8091, wait until it answers, and resume
# the run (recorded runs are skipped; failed calls were never recorded). Until 07:00 PST.
BENCH="$(cd "$(dirname "$0")/.." && pwd)"
MLX=/Users/gyanb/Desktop/canon/research/exp1/.venv/bin/mlx_lm.server
LOG=/tmp/canonbench/mlx7b-watch.log
start_server() {
  pkill -f "mlx_lm.server --model mlx-community/Qwen2.5-Coder-7B-Instruct-8bit --port 8091"
  sleep 5
  cat "$LOG" >> /tmp/canonbench/mlx7b-history.log 2>/dev/null; : > "$LOG"
  nohup "$MLX" --model mlx-community/Qwen2.5-Coder-7B-Instruct-8bit --port 8091 --decode-concurrency 4 --prompt-concurrency 2 --prompt-cache-size 8 --prompt-cache-bytes 6000000000 > "$LOG" 2>&1 &
  until curl -s -m 300 localhost:8091/v1/chat/completions -H 'Content-Type: application/json' \
    -d '{"model":"mlx-community/Qwen2.5-Coder-7B-Instruct-8bit","messages":[{"role":"user","content":"ok"}],"max_tokens":2}' | grep -q choices; do sleep 5; done
}
start_runner() {
  echo "--- watchdog (re)start $(date)" >> /tmp/canonbench/main-qwen.log
  nohup "$BENCH/scripts/main-qwen.sh" >> /tmp/canonbench/main-qwen.log 2>&1 &
}
# the server and runner may already be up (restart only if not)
pgrep -f "main-qwen.sh" >/dev/null || { start_server; start_runner; }
while [ "$(date +%H%M)" -lt 0700 ] || [ "$(date +%H)" -gt 12 ]; do
  sleep 20
  if grep -q "generation thread died" "$LOG"; then
    echo "watchdog: server died $(date)"
    pkill -f "main-qwen.sh"; pkill -f "model qwen7b"
    start_server
    start_runner
  fi
  if tail -n 5 /tmp/canonbench/main-qwen.log | grep -q "ALL DONE qwen7b" && ! pgrep -f "main-qwen.sh" >/dev/null; then echo "watchdog: run complete"; exit 0; fi
done
echo "watchdog: 07:00 stop rule $(date)"
pkill -f "main-qwen.sh"; pkill -f "model qwen7b"
