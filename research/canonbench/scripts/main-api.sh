#!/bin/sh
# Main run for an API model (PREREGISTRATION.md section 4): every family, three runs. Each family
# is run twice: the second pass retries infrastructure failures (never wrong answers, which are
# recorded and therefore skipped).   usage: scripts/main-api.sh opus|gpt
cd "$(dirname "$0")/.." || exit 1
for fam in read write fix change; do
  npx tsx --conditions=source runner/run.ts --family "$fam" --model "$1" --seeds all --runs 3 --concurrency 8
  npx tsx --conditions=source runner/run.ts --family "$fam" --model "$1" --seeds all --runs 3 --concurrency 8
done
echo "ALL DONE $1 main $(date)"
