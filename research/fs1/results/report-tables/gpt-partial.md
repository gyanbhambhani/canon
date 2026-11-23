Records: 147 runs (0 infrastructure failures excluded), 29 tasks, models gpt-6.2-sol.

## FS-1 partial, gpt-6.2-sol: All tasks

### gpt-6.2-sol (baseline: openapi)

| Metric | direct | openapi | canon | canon − openapi |
| --- | --- | --- | --- | --- |
| End-to-end pass rate | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Mismatch rate | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| First-round pass (secondary) | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 56.9% [41.4%, 72.4%] | -43.1 pp [-58.6 pp, -27.6 pp] |
| Change-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Feature-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Validation agreement | 35.9% [24.8%, 47.1%] | 35.9% [24.6%, 47.0%] | 100.0% [100.0%, 100.0%] | +64.1 pp [+52.8 pp, +75.2 pp] |
| False acceptance (of runs the arm's checks approved) | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Arm's own checks pass at the end | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Tokens per run (input incl. cache + output) | 15812 [15269, 16368] | 15230 [14422, 16396] | 53877 [45171, 63370] | +38647 [+30179, +47801] |
| Output tokens per run | 1902 [1688, 2125] | 1694 [1513, 1884] | 1897 [1546, 2310] | +203 [-102, +545] |
| Edit rounds per run | 1.02 [1.00, 1.05] | 1.00 [1.00, 1.00] | 1.41 [1.22, 1.64] | +0.41 [+0.22, +0.64] |
| Wall time per run (s) | 50 [45, 55] | 50 [46, 54] | 69 [59, 79] | +19 [+10, +29] |
| Dollars per run | 0.030 [0.027, 0.033] | 0.028 [0.025, 0.031] | 0.039 [0.033, 0.045] | +0.011 [+0.006, +0.017] |

Primary (end-to-end pass, canon − openapi, margin 10.0%): **non-inferior** (0.0 pp [0.0 pp, 0.0 pp], 29 tasks).
Change-task success better: no (0.0 pp [0.0 pp, 0.0 pp]). Mismatch rate lower: no (0.0 pp [0.0 pp, 0.0 pp]).


## FS-1 partial, gpt-6.2-sol: Without adapted tasks

### gpt-6.2-sol (baseline: openapi)

| Metric | direct | openapi | canon | canon − openapi |
| --- | --- | --- | --- | --- |
| End-to-end pass rate | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Mismatch rate | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| First-round pass (secondary) | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 56.5% [39.1%, 73.9%] | -43.5 pp [-60.9 pp, -26.1 pp] |
| Change-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Feature-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Validation agreement | 41.2% [28.9%, 52.9%] | 41.2% [29.1%, 53.0%] | 100.0% [100.0%, 100.0%] | +58.8 pp [+47.1 pp, +71.1 pp] |
| False acceptance (of runs the arm's checks approved) | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Arm's own checks pass at the end | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Tokens per run (input incl. cache + output) | 15574 [14944, 16224] | 14471 [14045, 14944] | 51845 [41343, 63280] | +37374 [+27230, +48342] |
| Output tokens per run | 1776 [1540, 2017] | 1606 [1407, 1823] | 1871 [1453, 2349] | +265 [-66, +635] |
| Edit rounds per run | 1.02 [1.00, 1.07] | 1.00 [1.00, 1.00] | 1.39 [1.17, 1.65] | +0.39 [+0.17, +0.65] |
| Wall time per run (s) | 48 [44, 53] | 49 [45, 54] | 67 [56, 80] | +18 [+7, +31] |
| Dollars per run | 0.029 [0.026, 0.032] | 0.027 [0.024, 0.029] | 0.038 [0.031, 0.046] | +0.011 [+0.005, +0.018] |

Primary (end-to-end pass, canon − openapi, margin 10.0%): **non-inferior** (0.0 pp [0.0 pp, 0.0 pp], 23 tasks).
Change-task success better: no (0.0 pp [0.0 pp, 0.0 pp]). Mismatch rate lower: no (0.0 pp [0.0 pp, 0.0 pp]).

