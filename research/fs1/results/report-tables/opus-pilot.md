Records: 24 runs (0 infrastructure failures excluded), 8 tasks, models claude-opus-5-5.

## FS-1 pilot, claude-opus-5-5: All tasks

### claude-opus-5-5 (baseline: openapi)

| Metric | direct | openapi | canon | canon − openapi |
| --- | --- | --- | --- | --- |
| End-to-end pass rate | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Mismatch rate | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| First-round pass (secondary) | 50.0% [12.5%, 87.5%] | 75.0% [37.5%, 100.0%] | 87.5% [62.5%, 100.0%] | +12.5 pp [-25.0 pp, +50.0 pp] |
| Change-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Feature-task success | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Validation agreement | 42.6% [20.9%, 61.7%] | 59.3% [38.5%, 78.8%] | 100.0% [100.0%, 100.0%] | +40.7 pp [+20.6 pp, +62.2 pp] |
| False acceptance (of runs the arm's checks approved) | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0% [0.0%, 0.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Arm's own checks pass at the end | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 100.0% [100.0%, 100.0%] | 0.0 pp [0.0 pp, 0.0 pp] |
| Tokens per run (input incl. cache + output) | 37114 [28390, 46474] | 29728 [23685, 37519] | 32824 [26548, 41150] | +3097 [-5154, +13069] |
| Output tokens per run | 4795 [3393, 6340] | 3657 [2763, 4683] | 3234 [2685, 3840] | -423 [-1510, +544] |
| Edit rounds per run | 1.50 [1.13, 1.88] | 1.25 [1.00, 1.63] | 1.13 [1.00, 1.38] | -0.13 [-0.50, +0.25] |
| Wall time per run (s) | 60 [42, 80] | 46 [37, 58] | 38 [33, 44] | -8 [-20, +3] |
| Dollars per run | 0.225 [0.168, 0.287] | 0.177 [0.139, 0.224] | 0.132 [0.108, 0.163] | -0.045 [-0.093, -0.001] |

Primary (end-to-end pass, canon − openapi, margin 10.0%): **non-inferior** (0.0 pp [0.0 pp, 0.0 pp], 8 tasks).
Change-task success better: no (0.0 pp [0.0 pp, 0.0 pp]). Mismatch rate lower: no (0.0 pp [0.0 pp, 0.0 pp]).


