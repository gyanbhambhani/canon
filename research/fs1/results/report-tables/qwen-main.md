Records: 180 runs (138 infrastructure failures excluded), 60 tasks, models Qwen2.5-Coder-7B-Instruct-8bit.

## Qwen 7B main (exploratory): All tasks

### Qwen2.5-Coder-7B-Instruct-8bit (baseline: openapi)

| Metric | direct | openapi | canon | canon − openapi |
| --- | --- | --- | --- | --- |
| End-to-end pass rate | 6.7% [0.0%, 20.0%] | 0.0% [0.0%, 0.0%] | 7.7% [0.0%, 23.1%] | +7.7 pp [0.0 pp, +23.1 pp] |
| Mismatch rate | 80.0% [60.0%, 100.0%] | 71.4% [50.0%, 92.9%] | 92.3% [76.9%, 100.0%] | +23.1 pp [-7.7 pp, +53.8 pp] |
| First-round pass (secondary) | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 7.7% [0.0%, 23.1%] | +7.7 pp [0.0 pp, +23.1 pp] |
| Change-task success | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 25.0% [0.0%, 75.0%] | +25.0 pp [0.0 pp, +75.0 pp] |
| Feature-task success | 9.1% [0.0%, 27.3%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Validation agreement | 36.0% [9.5%, 66.9%] | 61.0% [21.0%, 100.0%] | 81.0% [43.0%, 100.0%] | +33.3 pp [0.0 pp, +100.0 pp] |
| False acceptance (of runs the arm's checks approved) | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 66.7% [0.0%, 100.0%] | – |
| Arm's own checks pass at the end | 73.3% [53.3%, 93.3%] | 21.4% [0.0%, 42.9%] | 23.1% [0.0%, 46.2%] | 0.0 pp [-38.5 pp, +38.5 pp] |
| Tokens per run (input incl. cache + output) | 42044 [36191, 46178] | 47450 [42631, 52672] | 50657 [38393, 61674] | +3899 [-8230, +14842] |
| Output tokens per run | 3190 [2563, 3817] | 3335 [2472, 4235] | 2978 [2210, 3763] | -197 [-1180, +740] |
| Edit rounds per run | 4.73 [4.20, 5.00] | 5.00 [5.00, 5.00] | 3.92 [2.77, 5.00] | -1.08 [-2.23, 0.00] |
| Wall time per run (s) | 289 [242, 335] | 319 [258, 381] | 258 [202, 310] | -53 [-116, +5] |
| Dollars per run | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] | 0.000 [0.000, 0.000] |

Primary (end-to-end pass, canon − openapi, margin 10.0%): **non-inferior** (+7.7 pp [0.0 pp, +23.1 pp], 13 tasks).
Change-task success better: no (+25.0 pp [0.0 pp, +75.0 pp]). Mismatch rate lower: no (+23.1 pp [-7.7 pp, +53.8 pp]). Every arm passes under 10%: this model is reported as exploratory.


