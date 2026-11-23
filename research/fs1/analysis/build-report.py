"""Assemble REPORT.md from results/*.jsonl and results/report-tables (written by analysis/analyze.ts).
   python3 analysis/build-report.py"""
import json, os, glob

def jl(path):
    return [json.loads(l) for l in open(path).read().split("\n") if l.strip()] if os.path.exists(path) else []
def infra(r):
    return r.get("finished") == "error" and bool(r.get("error")) and not r["error"].startswith("refusal")
def real(rs):
    latest = {}
    for r in rs:
        p = latest.get(r["key"])
        if p is None or infra(p):
            latest[r["key"]] = r
    return [r for r in latest.values() if not infra(r)]
def table(name):
    return open(f"results/report-tables/{name}.md").read().rstrip()

gpt = real(jl("results/main-gpt.jsonl") + jl("results/main-gpt-r3.jsonl"))
gpt_pilot = real(jl("results/pilot-gpt.jsonl"))
opus_pilot = real(jl("results/pilot-claude.jsonl"))
q_pilot = real(jl("results/pilot-qwen.jsonl"))
q_main = real(jl("results/main-qwen.jsonl"))
tasks = sorted(d for d in os.listdir("tasks") if os.path.exists(f"tasks/{d}/task.json"))
meta = {t: json.load(open(f"tasks/{t}/task.json")) for t in tasks}
arms = ["direct", "openapi", "canon"]

def mean(xs): return sum(xs) / len(xs)
rem = {a: 180 - len([r for r in gpt if r["arm"] == a]) for a in arms}
per = {a: mean([r["dollars"] for r in gpt if r["arm"] == a]) for a in arms}
gpt_remaining_cost = sum(rem[a] * per[a] for a in arms)
gpt_spent = sum(r["dollars"] for r in gpt + gpt_pilot)
op_mean = mean([r["dollars"] for r in opus_pilot])
op_spent = sum(r["dollars"] for r in opus_pilot)
op_pilot_left = 30 - len(opus_pilot)
op_cost = op_mean * (360 + op_pilot_left)

adapted = [(t, meta[t]["adapted"]["reason"]) for t in tasks if meta[t].get("adapted")]

def qline(rs, n):
    p = sum(1 for r in rs if r["pass"])
    return f"{len(rs)} of {n} real runs so far, {p} passed"

out = f"""# Experiment FS-1: report

Written 2026-11-23 from `results/*.jsonl`, with every table produced by the committed analysis script
(`analysis/analyze.ts`; pre-registration in `PREREGISTRATION.md`, amendments 1 to 3). **The run is
incomplete, and there is no verdict on whether Canon is the better full-stack language for agents.**

## Read this first

- **Both frontier models are partial or absent.**
  - **claude-opus-5-5** stopped on credit during the pilot: {len(opus_pilot)} of 30 pilot runs exist (8 of
    the 10 pilot tasks, all three arms) and **no main-run run was made**.
  - **gpt-6.2-sol** stopped on credit part-way through the main run: **{len(gpt)} of 540** planned runs
    exist, on 33 of the 60 tasks, and no task reached the pre-registered 3 runs.
- **The pre-registered win rule cannot be evaluated.** It needs both frontier models. This report gives
  the measured effects with their 95% intervals and **no verdict**.
- **Qwen2.5-Coder-7B (exploratory)** is not finished: {qline(q_pilot, 30)} in the pilot and
  {qline(q_main, 180)} in the main run, because the shared local server kept crashing. Qwen2.5-Coder-32B was
  dropped (its weights could not be downloaded) and nothing about it is analyzed.
- **What the owner has to do to complete the run** is at the end of this report.

## What was measured, and how far the data goes

| Model | Pilot (30 planned) | Main run | Status |
| --- | --- | --- | --- |
| gpt-6.2-sol | {len(gpt_pilot)} runs, all passed | {len(gpt)} of 540 | stopped: OpenAI account out of credit |
| claude-opus-5-5 | {len(opus_pilot)} runs, all passed | 0 of 360 (2 runs per task as pre-registered) | stopped: Anthropic account out of credit, in the pilot |
| Qwen2.5-Coder-7B | {len(q_pilot)} real runs, {sum(1 for r in q_pilot if r['pass'])} passed | {len(q_main)} real runs of 180, {sum(1 for r in q_main if r['pass'])} passed | exploratory; local server crashes |

The 188 GPT records that were infrastructure failures (183 "no credits remaining", 3 timeouts, 1
connection error, 1 terminated process) and the Qwen runs that hit a dead server are not results. They
are kept, unscored, in `results/dropped-*` and are replaced by reruns in the analysis. The GPT data
covers an alphabetical prefix of the task list (both replicates visited tasks in order), so it is not a
random sample of the 60 tasks: 29 tasks (23 feature, 6 change, 6 adapted) are in the paired partial
analysis, and 27 tasks have no GPT run at all, among them 13 of the 21 change tasks (the change tasks are under-represented in the GPT data).

## The pilot and its difficulty check

10 tasks drawn with seed 2026 (7 feature, 3 change; 2 adapted): paginate-orders, product-count-by-tag,
related-products, low-stock-report, order-notes, default-address, search-products, status-to-string,
split-pay, tighten-password-rule. **The difficulty check failed for both frontier models:** every arm
passed every run (GPT 30 of 30; Opus 24 of 24), so end-to-end pass, the pre-registered primary
metric, is at its ceiling and cannot separate the arms. There was no time overnight to author harder
tasks, so the main run kept the plan's primary analysis and added a secondary measure, **first-round
pass** (the hidden suite's verdict right after the agent's first edit round).

Power analysis on the pilot: non-inferiority margin **10 percentage points** (the pre-set floor, because
the pilot's paired differences in pass rate have zero variance); runs per task 3 for GPT and 2 for Opus
(the largest R that fits 90% of the $100 cap), 1 for Qwen. Smallest detectable effects (80% power): first-round
pass 15.2 pp (GPT) and 23.2 pp (Opus); validation agreement about 10 pp. The ceiling effect makes
smaller differences in end-to-end pass, change-task success and mismatch rate undetectable.

## Primary outcome

Primary comparison (pre-registered): Canon against openapi, end-to-end pass rate, margin 10 pp.

| Model | Data | Canon − openapi | 95% interval | Outcome by the plan's rule |
| --- | --- | --- | --- | --- |
| gpt-6.2-sol | partial: 29 paired tasks, 147 runs | 0.0 pp | [0.0, 0.0] | non-inferior (the interval's lower end is above −10 pp) |
| gpt-6.2-sol | partial, without adapted tasks: 23 tasks | 0.0 pp | [0.0, 0.0] | non-inferior |
| claude-opus-5-5 | not run (pilot only, 8 tasks) | 0.0 pp | [0.0, 0.0] | pilot only, not a result |

"Non-inferior" here means every arm passed every run of the tasks that exist, so the data show no
difference at all; it is not evidence that Canon is better, and the tasks run so far are too easy to
show a loss. **No verdict on the win rule** (non-inferior on pass for both frontier models, and significantly
better on change-task success or mismatch rate): Opus has no main-run data, and for GPT neither change-task
success nor mismatch rate differs between arms (all 100% and 0%).

## Every metric, gpt-6.2-sol (partial, paired tasks, 95% bootstrap intervals over tasks)

{table('gpt-partial')}

### What these numbers say

- **End-to-end pass, mismatch, change-task success, feature-task success, false acceptance and the arm's own
  checks** are identical across the three arms: all runs passed, no mismatch, no false acceptance. At the
  ceiling nothing can be concluded about them.
- **First-round pass (secondary).** Canon's is clearly lower: 56.9% against 100% for both other arms; Canon
  − openapi −43.1 pp [−58.6, −27.6]. Canon runs took 1.41 edit rounds on average against 1.00 to 1.02. The
  agents reached the same final result in Canon, but needed a second pass more often.
- **Validation agreement.** Canon's is 100%; direct's and openapi's are 35.9% (Canon − openapi +64.1 pp
  [+52.8, +75.2]). This is the one metric where Canon is clearly better. The caveat: the tasks did not ask
  for client-side validation, so the hand-written arms' agents did not write any; Canon generates the client
  check from the same rule for free. It measures a real difference in what each setup gives you by default,
  not the agents' skill.
- **Cost.** Canon used 3.4× (against direct) to 3.5× (against openapi) the tokens per run (53,877 against
  15,230 for openapi; +38,647 [+30,179, +47,801]), mostly the 3,794-token reference sent with every request and the extra round, and
  about 39% more dollars per run ($0.039 against $0.028). Output tokens are about the same (+203
  [−102, +545]). The wall time is 69 s against 50 s.

## Against the pre-registered predictions (docs/v0.5-fullstack.md)

| Prediction | What the data show |
| --- | --- |
| feature tasks: Canon roughly ties both baselines | held, but only because every arm passed everything (GPT, partial) |
| change tasks and mismatch rate: Canon beats A clearly, and beats B by less | **not testable**: change-task success is 100% and mismatch 0% in every arm |
| validation agreement: Canon beats both | held: 100% against 35.9% (GPT); Opus pilot: 100% against 42.6% and 59.3% |
| cost: Canon uses more tokens, because of the reference | held: 3.4× to 3.5× the tokens for GPT |

## claude-opus-5-5, pilot only (8 tasks, 24 runs; not a result)

{table('opus-pilot')}

On the pilot, Opus's Canon arm was the cheapest in dollars and rounds (first-round pass 87.5% against 75.0%
and 50.0%), the opposite of GPT's first-round result, on 8 tasks; the intervals are very wide.

## Qwen2.5-Coder-7B (exploratory, unfinished)

Real runs so far: pilot {qline(q_pilot, 30)}; main {qline(q_main, 180)}. The pre-registered rule makes Qwen
exploratory (it passes under 10% in every arm in the pilot). With this few runs nothing can be said; the
real runs so far all ended at the 5-round limit and failed at least one boundary probe.
When the retry loop (`runner/local-until-done.sh`, on CanonBench's server, port 8091) finishes, refresh
this section with `npx tsx --conditions=source analysis/analyze.ts --results 'results/main-qwen.jsonl'
--config analysis/config-partial.json --label "Qwen 7B"`.

## Canon's expressiveness limits found by the task authors (tasks/BATCH-*-NOTES.md)

Ten tasks carry `"adapted"`: their spec was narrowed so a Canon reference could exist at all. The narrowed spec
applies to every arm, but it removes a failure mode only the Canon arm had, so it leans toward Canon. Every
analysis is reported with and without them (the GPT table above has both: the second half is without adapted
tasks; the primary outcome did not change). The adapted tasks and why:

""" + "\n".join(f"- **{t}**: {r}" for t, r in adapted) + f"""

Language limits the authors hit, each recorded with a reproduction in the batch notes:
- An api fn's portable `requires` cannot test characters ("has a digit", "starts with +", digits only), so those
  rules had to become domain errors (400) instead of validation (422).
- It cannot constrain an Option's value or each item of a list (no lambdas or `match` in the portable subset).
- A `requires` line had no fix when longer than 100 characters (COMPILER_ISSUES.md #1; since fixed).
- A variant name belongs to one type in the whole project, so two endpoints cannot share an error kind with
  different types.
- `return` is not allowed inside a match arm, and fmt rewrites nested calls into a one-line parenthesised pipeline.

## Compiler issues found during the build, and what was fixed

Found by the FS-1 task authors and recorded in the batch notes and `COMPILER_ISSUES.md`; the main thread fixed
these on main before the pilot: a long `requires` chain breaks before `&&`/`||`; no temporaries are hoisted out of
lambdas or loop conditions (the `unwrap_or` inside a lambda read an unbound name in the generated Python);
forward-referenced model fields; `store.py` is always written; long match arms break. Not fixed, by design: the
language limits in the list above.

## Deviations from the plan

- Tasks: 39 feature and 21 change, not 40 and 20; ten tasks adapted for Canon (see above).
- The pilot hit the ceiling for both frontier models; end-to-end pass was kept as primary and first-round pass
  added as a secondary measure (PREREGISTRATION.md).
- Opus stopped on credit during the pilot; GPT stopped on credit during the main run; the win rule is
  undecidable (Amendments 1 and 3).
- Qwen-7B runs on CanonBench's shared server (two servers crashed one); Qwen-32B was dropped (Amendments 1 and 2).
- The agent protocol is text-based (`<read/>`, `<write>`, `<run>`), not native tool calling; every arm gets tsc
  and eslint on its frontend; Opus runs at effort medium without a temperature; GPT at reasoning effort medium.
- GPT's runs per task: 3 were pre-registered; at most 2 exist.
- One change to a pinned file after pre-registration: `runner/run.ts` treats OpenAI credit errors like Anthropic's
  (new hash in Amendment 3); it changes no scoring.
- The analysis' win-rule line is not reported, by the coordinator's instruction.

## What the owner needs to add to complete the run

Both accounts are out of credit; refill them and re-run the same commands (failed calls were never
recorded, so recorded runs are skipped).

| Account | Model | Remaining | Estimated cost | Basis |
| --- | --- | --- | --- | --- |
| Anthropic API | claude-opus-5-5 | {op_pilot_left} pilot runs + 360 main runs (2 per task) | **about ${op_cost:.0f}** | pilot mean ${op_mean:.3f} per run; already spent on the pilot ${op_spent:.2f} |
| OpenAI API | gpt-6.2-sol | {sum(rem.values())} of 540 runs | **about ${gpt_remaining_cost:.0f}** | observed means per run: direct ${per['direct']:.3f}, openapi ${per['openapi']:.3f}, canon ${per['canon']:.3f}; spent so far ${gpt_spent:.2f} |

Both are under the pre-registered $100 cap per model (the runner enforces it from the recorded dollars). Adding
about $70 on Anthropic and $15 on OpenAI leaves a margin. Commands, from `research/fs1`:

```sh
T=$(ls tasks | grep -v -E "README|BATCH" | tr '\\n' ',' | sed 's/,$//')
# GPT: replicates 1 and 2, then replicate 3 (its own file)
npx tsx --conditions=source runner/run.ts --model gpt-6.2-sol --tasks "$T" --first-run 1 --runs 2 --concurrency 4 --cap 100 \\
  --spent results/pilot-gpt.jsonl,results/main-gpt.jsonl,results/main-gpt-r3.jsonl --out results/main-gpt.jsonl
npx tsx --conditions=source runner/run.ts --model gpt-6.2-sol --tasks "$T" --first-run 3 --runs 1 --concurrency 4 --cap 100 \\
  --spent results/pilot-gpt.jsonl,results/main-gpt.jsonl,results/main-gpt-r3.jsonl --out results/main-gpt-r3.jsonl
# Opus: finish the pilot, then the main run
P=paginate-orders,product-count-by-tag,related-products,low-stock-report,order-notes,default-address,search-products,status-to-string,split-pay,tighten-password-rule
npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks "$P" --runs 1 --concurrency 3 --cap 100 \\
  --spent results/pilot-claude.jsonl,results/main-claude.jsonl --out results/pilot-claude.jsonl
npx tsx --conditions=source runner/run.ts --model claude-opus-5-5 --tasks "$T" --runs 2 --concurrency 3 --cap 100 \\
  --spent results/pilot-claude.jsonl,results/main-claude.jsonl --out results/main-claude.jsonl
# then the pre-registered analysis, on everything
npx tsx --conditions=source analysis/analyze.ts --results 'results/main-*.jsonl' --json results/summary.json
```

With all runs in, the pre-registered win rule can be evaluated by that last command.
"""
open("REPORT.md", "w").write(out)
print("REPORT.md written,", len(out), "characters")
