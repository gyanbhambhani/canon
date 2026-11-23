#!/bin/sh
# Probe claude-opus-5-5 about every 15 minutes; when it answers, finish its pilot, then run its main
# run under PREREGISTRATION.md (2 runs per task, $100 cap across pilot and main files).
cd "$(dirname "$0")/.." || exit 1
TASKS=$(ls tasks | grep -v -E "README|BATCH" | tr '\n' ',' | sed 's/,$//')
PILOT=paginate-orders,product-count-by-tag,related-products,low-stock-report,order-notes,default-address,search-products,status-to-string,split-pay,tighten-password-rule
while :; do
  status=$(npx tsx runner/probe.ts 2>&1 | tail -1)
  echo "$(date -u +%H:%M:%SZ) probe: $status"
  if [ "$status" = "available" ]; then
    npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks "$PILOT" --runs 1 --concurrency 3 --cap 100 \
      --spent results/pilot-claude.jsonl,results/main-claude.jsonl --out results/pilot-claude.jsonl
    npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks "$TASKS" --runs 2 --concurrency 3 --cap 100 \
      --spent results/pilot-claude.jsonl,results/main-claude.jsonl --out results/main-claude.jsonl
    # the runner stops on a credit failure without recording it: keep probing until every run exists
    if [ "$(grep -c . results/main-claude.jsonl 2>/dev/null)" -ge 360 ]; then echo "opus main run complete"; exit 0; fi
  fi
  sleep 900
done
