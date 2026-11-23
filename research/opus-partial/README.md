# What the Claude Opus 5.5 runs show (partial, 2026-11-23)

The Anthropic account ran out of credit at 01:18 PST, so every Opus run stopped. This note reads
what was recorded before that. **None of it is a pre-registered result.** The CanonBench READ
numbers come from the main run, cut off at 1,753 of 2,376 answers. Everything else is from the
pilots (10 seeds, a few tasks), which exist to check the pipeline and the difficulty, not to
compare languages. Reproduce with `python3 research/opus-partial/analyze.py <canonbench results>
<fs1 results>`. The spend was about $23 (CanonBench $18.20, FS-1 $4.66).

## The finding: Opus is at the ceiling in every language

On every task it was given, Opus scores 95 to 100 percent in all three languages. Nothing here
separates Canon from Python or TypeScript.

| Test | Canon | Python | TypeScript | What it shows |
| --- | --- | --- | --- | --- |
| READ, all questions (1,753 answers, 76 seeds) | 99.5% | 99.7% | 100.0% | Canon minus Python: −0.5 points [−2.0, +0.5] |
| READ, effects questions | 100% | 99.2% | 100% | +0.8 [0.0, +2.3] over Python |
| READ, output and failure questions | 100% | 100% | 100% | no difference |
| READ, property questions | 98.1% | 100% | 100% | −1.9 [−5.8, 0.0] |
| READ, Canon with its contracts and effects stripped | 99.5% | | | identical to full Canon |
| WRITE, FIX, CHANGE, THINK pilots | 10/10, 14/14, 8/8, 10/10 | same | same | no failures anywhere |
| FS-1 pilot, 8 tasks: end-to-end pass | 8/8 | 8/8 (direct) | 8/8 (OpenAPI) | no mismatch in any arm |

The effects questions are where Canon was supposed to help most, and the Python result is already
99.2%, so there is no room to show it. The annotation control also says that for Opus the
written-down contracts and effects add nothing, because it answers the same questions equally well
without them.

## Where Canon does differ

- **Validation agreement (FS-1 pilot):** the client and server agree on what is valid in 100% of
  sampled inputs when the agent wrote Canon, against 43% (direct) and 59% (OpenAPI client) when
  it wrote the two sides by hand. The pass rates are identical, so this is a property of the
  tool, not of how well Opus wrote the code: Canon states a rule once, and the hand-written
  arms' client checks are often missing or looser than the server's. A reference solution shows the
  same gap, so this is a design result more than an agent result. It reproduced with GPT-6.2 Sol
  (1.00 against 0.37).
- **Rounds and cost, FS-1 pilot:** Canon took the fewest edit rounds (1.1 against 1.5 and 1.2)
  and the lowest cost ($1.06 for 8 tasks against $1.80 and $1.42), even with its 3,800-token
  reference counted. With 8 tasks per arm this is anecdote, not a finding.
- **Cost of reading (READ):** a Canon question takes about 4,800 tokens in Opus's prompt, against
  900 for Python and 800 for TypeScript, because Canon's reference is in every prompt. With prompt
  caching the dollar cost was small (about $0.01 per answer), but this is a real overhead and
  matches the pre-registered "Canon costs more" prediction.

## What this does and does not support

- **Supported:** a frontier model understands, writes, fixes and changes Canon as well as it does
  Python and TypeScript, from a reference alone. Opus never failed in Canon on a pilot task.
- **Not supported, because Opus has no room to improve:** any claim that Canon helps a strong model
  read, write, fix or change code better. That would need harder tasks. The suites were built
  mainly to be answerable by small models, so a strong model has little room to fail.
- **The only measured Canon advantage for a frontier model is structural**: a rule written once is
  enforced identically on both sides.

## What the other results say (the same pattern, with weaker models)

The pilot scoreboard in CanonBench shows the gap is on the small model, not the frontier ones. On
Qwen2.5-Coder 7B, Canon is *behind* on WRITE and THINK (0% against 20% to 43%), and slightly
ahead on READ (52% against 46% to 49%). That is the opposite of the plan's prediction for the
small model, which is exactly what the full runs are for.

## Evals this suggests, for when credit returns

1. **Harder items for frontier models:** WRITE and FIX tasks that Opus fails 30% to 60% of the
   time in Python, such as multi-function programs with a subtle invariant, so a language
   difference has room to appear. Pick them from the pilot's difficulty check, not by hand.
2. **Stripped-annotation READ on effects only, with deeper call chains** (effects hidden three
   to five calls down), since the one-or-two-call version is already at 99%+ in Python.
3. **Silent-failure rate** (code that passes its own checks but returns wrong answers), which
   Experiment 1 measures and CanonBench reports as false acceptance. It needs failing runs, so
   it needs weaker models or harder tasks.
4. **Mismatch under change:** FS-1's change tasks with the OpenAPI arm as baseline, the case where
   the prediction was that Canon wins by less than against hand-written code.
