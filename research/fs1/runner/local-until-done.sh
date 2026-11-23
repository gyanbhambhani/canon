#!/bin/sh
# Run a local model until every (task, arm) has a non-infrastructure record. Usage:
#   runner/local-until-done.sh MODEL_NAME PORT OUT.jsonl TASKS_COMMA_SEPARATED [CONCURRENCY]
# Before each attempt it makes one real generation call (a model list is not proof: a server also
# lists models it has cached but not loaded). It never starts a server. A run that hit a dead
# server is an infrastructure failure: the runner skips recorded runs except those, and the
# analysis replaces them with their reruns.
cd "$(dirname "$0")/.." || exit 1
NAME=$1; PORT=$2; OUT=$3; TASKS=$4; CONC=${5:-1}
EXPECT=$(echo "$TASKS" | tr ',' '\n' | wc -l | tr -d ' ')
EXPECT=$((EXPECT * 3))
pending() {
  node -e '
    const fs=require("fs"); const out=process.argv[1]; const want=Number(process.argv[2]);
    const by=new Map(); if (fs.existsSync(out)) for (const l of fs.readFileSync(out,"utf8").split("\n").filter(Boolean)) {
      const r=JSON.parse(l); const infra=r.finished==="error"&&!!r.error&&!/^refusal/.test(r.error);
      const prev=by.get(r.key); if (!prev||prev.infra) by.set(r.key,{infra});
    }
    const ok=[...by.values()].filter(v=>!v.infra).length; console.log(want-ok);' "$OUT" "$EXPECT"
}
for attempt in $(seq 1 100); do
  left=$(pending)
  echo "$(date -u +%H:%M:%SZ) attempt $attempt: $left of $EXPECT runs still to do"
  [ "$left" = "0" ] && { echo complete; exit 0; }
  reply=$(curl -s -m 180 "localhost:$PORT/v1/chat/completions" -H 'content-type: application/json' \
    -d "{\"model\":\"mlx-community/$NAME\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with OK.\"}],\"max_tokens\":8}")
  if echo "$reply" | grep -q '"choices"'; then
    nice -n 10 npx tsx --conditions=source runner/run.ts --model "local:$NAME" --port "$PORT" --tasks "$TASKS" --runs 1 --concurrency "$CONC" --out "$OUT"
  else
    echo "server on $PORT does not generate yet; waiting"
  fi
  sleep 300
done
echo "gave up after 100 attempts"
