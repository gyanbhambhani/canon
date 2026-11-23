#!/bin/sh
# Main run for Qwen, run-major (PREREGISTRATION.md section 4): run 0 of every family, then run 1,
# then run 2. `--runs N` makes the runner schedule run indexes 0..N-1 and skip the recorded ones.
cd "$(dirname "$0")/.." || exit 1
for runs in 1 2 3; do
  for fam in read write fix change; do
    npx tsx --conditions=source runner/run.ts --family "$fam" --model qwen7b --seeds all --runs "$runs" --concurrency 6
    npx tsx --conditions=source runner/run.ts --family "$fam" --model qwen7b --seeds all --runs "$runs" --concurrency 6
  done
  echo "RUN $runs COMPLETE $(date)"
done
echo "ALL DONE qwen7b main $(date)"
