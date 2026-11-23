#!/bin/sh
# Exploratory Canon-Py arm on Qwen 7B (PREREGISTRATION.md amendment 2), alongside the main run:
# WRITE (and so THINK) on the 10 pilot seeds x 3 runs, then the 32B subset's seeds x 3 runs, then
# FIX and CHANGE on the pilot seeds. Each step repeats until nothing is left to do (a server
# restart leaves failed calls unrecorded), until 06:45 PST.
cd "$(dirname "$0")/.." || exit 1
SUBSET=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("items/subset-32b.json","utf8")).seeds.join(","))')
step() {
  while [ "$(date +%H%M)" -lt 0645 ] || [ "$(date +%H)" -gt 12 ]; do
    out=$(npx tsx --conditions=source runner/run.ts --model qwen7b --langs cpy --tag cpy --concurrency 2 "$@" 2>&1)
    echo "$out" | grep -E "runs to do|^\[" | tail -3
    echo "$out" | grep -q " 0 runs to do" && return 0
    echo "$out" | grep -q "ERROR" && sleep 60
  done
}
step --family write --seeds pilot --runs 3
step --family write --seeds "$SUBSET" --runs 3
step --family fix --seeds pilot --runs 1
step --family change --seeds pilot --runs 1
echo "ALL DONE cpy $(date)"
