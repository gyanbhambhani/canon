#!/bin/sh
# Run families one after another for one model.
# usage: scripts/run-families.sh <model> <concurrency> <seeds: pilot|all> <tag> <runs> <families...>
cd "$(dirname "$0")/.." || exit 1
model=$1; conc=$2; seeds=$3; tag=$4; runs=$5
shift 5
for fam in "$@"; do
  npx tsx --conditions=source runner/run.ts --family "$fam" --model "$model" --seeds "$seeds" --tag "$tag" --runs "$runs" --concurrency "$conc"
done
echo "ALL DONE $model $tag"
