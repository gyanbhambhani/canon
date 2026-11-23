## Scoreboard (pilot; margin m = 10 points)

Each cell: verdict, Canon minus baseline in percentage points [95% bootstrap interval over seeds], Holm-adjusted p, seeds.

| Family | mlx-community/Qwen2.5-Coder-7B-Instruct-8bit | claude-opus-5-5 | gpt-6.2-sol |
| --- | --- | --- | --- |
| READ | **non-inferior** +6.0 [-8.3, +22.0] p=1.000 n=14 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=14 (vs py) | **non-inferior** +6.0 [+0.0, +12.5] p=0.461 n=14 (vs py) |
| READ-effects | **inconclusive** -12.5 [-25.0, +0.0] p=1.000 n=4 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=4 (vs py) | **non-inferior** +12.5 [+0.0, +25.0] p=0.554 n=4 (vs py) |
| READ-property | **non-inferior** +11.1 [+0.0, +33.3] p=1.000 n=9 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=9 (vs py) | **non-inferior** +11.1 [+0.0, +33.3] p=1.000 n=9 (vs py) |
| READ-output | **non-inferior** +15.0 [-5.0, +40.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) |
| WRITE | **inconclusive** -20.0 [-50.0, +0.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) |
| FIX | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=7 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=7 (vs py) |
| CHANGE | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=8 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=8 (vs py) |
| THINK | **inconclusive** -20.0 [-50.0, +0.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=10 (vs py) |

### Arm means per cell (seed-averaged, %)

| Family | Model | arms |
| --- | --- | --- |
| READ | qwen7b | canon 52.4, canon-stripped 49.4, py 46.4, ts 48.8 |
| READ | opus | canon 95.2, canon-stripped 95.2, py 95.2, ts 95.2 |
| READ | gpt | canon 95.2, canon-stripped 95.2, py 89.3, ts 95.2 |
| READ-effects | qwen7b | canon 37.5, canon-stripped 31.3, py 50.0, ts 50.0 |
| READ-effects | opus | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| READ-effects | gpt | canon 100.0, canon-stripped 100.0, py 87.5, ts 100.0 |
| READ-property | qwen7b | canon 88.9, canon-stripped 88.9, py 77.8, ts 88.9 |
| READ-property | opus | canon 77.8, canon-stripped 77.8, py 77.8, ts 77.8 |
| READ-property | gpt | canon 77.8, canon-stripped 77.8, py 66.7, ts 77.8 |
| READ-output | qwen7b | canon 40.0, canon-stripped 40.0, py 25.0, ts 25.0 |
| READ-output | opus | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| READ-output | gpt | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| WRITE | qwen7b | canon 0.0, py 20.0, ts 42.9 |
| WRITE | opus | canon 100.0, py 100.0, ts 100.0 |
| WRITE | gpt | canon 100.0, py 100.0, ts 100.0 |
| FIX | opus | canon 100.0, py 100.0, ts 100.0 |
| FIX | gpt | canon 100.0, py 100.0, ts 100.0 |
| CHANGE | opus | canon 100.0, py 100.0, ts 100.0 |
| CHANGE | gpt | canon 100.0, py 100.0, ts 100.0 |
| THINK | qwen7b | canon->py 0.0, py 20.0 |
| THINK | opus | canon->py 100.0, py 100.0 |
| THINK | gpt | canon->py 100.0, py 100.0 |

### Cost: tokens per item, Canon / baseline

| Family | Model | Baseline | Ratio [95% CI] | Verdict |
| --- | --- | --- | --- | --- |
| read | qwen7b | py | 5.33 [4.63, 6.09] | lose (more tokens) |
| read | opus | py | 5.37 [4.50, 6.53] | lose (more tokens) |
| read | gpt | py | 6.04 [5.10, 7.28] | lose (more tokens) |
| write | qwen7b | py | 9.43 [5.05, 15.81] | lose (more tokens) |
| write | opus | py | 4.62 [3.77, 5.74] | lose (more tokens) |
| write | gpt | py | 4.78 [3.97, 5.81] | lose (more tokens) |
| fix | opus | py | 2.83 [2.42, 3.22] | lose (more tokens) |
| fix | gpt | py | 2.92 [2.50, 3.34] | lose (more tokens) |
| change | opus | py | 2.91 [2.35, 3.62] | lose (more tokens) |
| change | gpt | py | 3.49 [2.64, 4.72] | lose (more tokens) |

### Annotation ablation (READ)

| Model | Row | Comparison | Difference [95% CI] | n |
| --- | --- | --- | --- | --- |
| qwen7b | READ | Canon - stripped Canon (value of the annotations) | +3.0 [-9.5, +14.9] | 14 |
| qwen7b | READ | stripped Canon - py (syntax alone) | +3.0 [-7.1, +14.3] | 14 |
| qwen7b | READ-effects | Canon - stripped Canon (value of the annotations) | +6.3 [+0.0, +18.8] | 4 |
| qwen7b | READ-effects | stripped Canon - py (syntax alone) | -18.8 [-25.0, -6.3] | 4 |
| qwen7b | READ-property | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 9 |
| qwen7b | READ-property | stripped Canon - py (syntax alone) | +11.1 [+0.0, +33.3] | 9 |
| qwen7b | READ-output | Canon - stripped Canon (value of the annotations) | +0.0 [-30.0, +25.0] | 10 |
| qwen7b | READ-output | stripped Canon - py (syntax alone) | +15.0 [+0.0, +40.0] | 10 |
| opus | READ | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 14 |
| opus | READ | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 14 |
| opus | READ-effects | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 4 |
| opus | READ-effects | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 4 |
| opus | READ-property | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 9 |
| opus | READ-property | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 9 |
| opus | READ-output | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 10 |
| opus | READ-output | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 10 |
| gpt | READ | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 14 |
| gpt | READ | stripped Canon - py (syntax alone) | +6.0 [+0.0, +12.5] | 14 |
| gpt | READ-effects | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 4 |
| gpt | READ-effects | stripped Canon - py (syntax alone) | +12.5 [+0.0, +25.0] | 4 |
| gpt | READ-property | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 9 |
| gpt | READ-property | stripped Canon - py (syntax alone) | +11.1 [+0.0, +33.3] | 9 |
| gpt | READ-output | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 10 |
| gpt | READ-output | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 10 |

### Per arm: pass rate, first-try check, self-healing, false acceptance, rounds, tokens, cost

| Family | Model | Arm | Runs | Pass % | First check ok % | Self-healing % (errors) | False acceptance % (accepted) | Rounds | Tokens/run | Tokens/pass | USD | Wall s | Regression % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| read | qwen7b | canon | 40 | 55.0 | – | – (0) | – (0) | – | 3307 | 6013 | 0.00 | 336 | – |
| read | qwen7b | canon-stripped | 40 | 50.0 | – | – (0) | – (0) | – | 3278 | 6556 | 0.00 | 231 | – |
| read | qwen7b | py | 40 | 50.0 | – | – (0) | – (0) | – | 677 | 1354 | 0.00 | 300 | – |
| read | qwen7b | ts | 40 | 52.5 | – | – (0) | – (0) | – | 520 | 990 | 0.00 | 185 | – |
| read | opus | canon | 40 | 95.0 | – | – (0) | – (0) | – | 4823 | 5077 | 0.53 | 132 | – |
| read | opus | canon-stripped | 40 | 95.0 | – | – (0) | – (0) | – | 4888 | 5146 | 0.44 | 158 | – |
| read | opus | py | 40 | 95.0 | – | – (0) | – (0) | – | 1025 | 1079 | 0.28 | 92 | – |
| read | opus | ts | 40 | 95.0 | – | – (0) | – (0) | – | 852 | 896 | 0.27 | 98 | – |
| read | gpt | canon | 40 | 95.0 | – | – (0) | – (0) | – | 3120 | 3284 | 0.06 | 57 | – |
| read | gpt | canon-stripped | 40 | 95.0 | – | – (0) | – (0) | – | 3113 | 3277 | 0.03 | 51 | – |
| read | gpt | py | 40 | 87.5 | – | – (0) | – (0) | – | 585 | 669 | 0.05 | 52 | – |
| read | gpt | ts | 40 | 95.0 | – | – (0) | – (0) | – | 468 | 492 | 0.04 | 52 | – |
| write | qwen7b | canon | 10 | 0.0 | 0.0 | 0.0 (40) | – (0) | 3.00 | 17051 | – | 0.00 | 1039 | – |
| write | qwen7b | py | 10 | 20.0 | 60.0 | 0.0 (94) | 75.0 (8) | 0.80 | 3115 | 15574 | 0.00 | 459 | – |
| write | qwen7b | ts | 7 | 42.9 | 71.4 | 0.0 (5) | 57.1 (7) | 0.29 | 1222 | 2851 | 0.00 | 205 | – |
| write | opus | canon | 10 | 100.0 | 80.0 | 40.0 (5) | 0.0 (10) | 0.20 | 7620 | 7620 | 0.46 | 173 | – |
| write | opus | py | 10 | 100.0 | 100.0 | – (0) | 0.0 (10) | 0.00 | 1608 | 1608 | 0.20 | 73 | – |
| write | opus | ts | 10 | 100.0 | 100.0 | – (0) | 0.0 (10) | 0.00 | 1374 | 1374 | 0.17 | 63 | – |
| write | gpt | canon | 10 | 100.0 | 90.0 | 88.9 (9) | 0.0 (10) | 0.10 | 4287 | 4287 | 0.10 | 149 | – |
| write | gpt | py | 10 | 100.0 | 100.0 | – (0) | 0.0 (10) | 0.00 | 908 | 908 | 0.05 | 58 | – |
| write | gpt | ts | 10 | 100.0 | 100.0 | – (0) | 0.0 (10) | 0.00 | 875 | 875 | 0.05 | 61 | – |
| fix | opus | canon | 14 | 100.0 | 100.0 | – (0) | 0.0 (14) | 0.00 | 5719 | 5719 | 0.28 | 81 | – |
| fix | opus | py | 14 | 100.0 | 100.0 | – (0) | 0.0 (14) | 0.00 | 2087 | 2087 | 0.29 | 88 | – |
| fix | opus | ts | 14 | 100.0 | 92.9 | 0.0 (1) | 0.0 (14) | 0.07 | 1757 | 1757 | 0.23 | 65 | – |
| fix | gpt | canon | 14 | 100.0 | 100.0 | – (0) | 0.0 (14) | 0.00 | 3943 | 3943 | 0.10 | 102 | – |
| fix | gpt | py | 14 | 100.0 | 100.0 | – (0) | 0.0 (14) | 0.00 | 1399 | 1399 | 0.10 | 101 | – |
| fix | gpt | ts | 14 | 100.0 | 100.0 | – (0) | 0.0 (14) | 0.00 | 1130 | 1130 | 0.07 | 75 | – |
| change | opus | canon | 8 | 100.0 | 100.0 | – (0) | 0.0 (8) | 0.00 | 5604 | 5604 | 0.19 | 62 | 0.0 |
| change | opus | py | 8 | 100.0 | 100.0 | – (0) | 0.0 (8) | 0.00 | 2077 | 2077 | 0.19 | 68 | 0.0 |
| change | opus | ts | 8 | 100.0 | 100.0 | – (0) | 0.0 (8) | 0.00 | 1519 | 1519 | 0.14 | 49 | 0.0 |
| change | gpt | canon | 8 | 100.0 | 87.5 | 60.0 (5) | 0.0 (8) | 0.13 | 4269 | 4269 | 0.06 | 66 | 0.0 |
| change | gpt | py | 8 | 100.0 | 100.0 | – (0) | 0.0 (8) | 0.00 | 1245 | 1245 | 0.05 | 64 | 0.0 |
| change | gpt | ts | 8 | 100.0 | 100.0 | – (0) | 0.0 (8) | 0.00 | 887 | 887 | 0.03 | 40 | 0.0 |
| think | qwen7b | canon->py | 10 | 0.0 | 0.0 | 0.0 (40) | – (0) | 3.00 | 17051 | – | 0.00 | 1039 | – |
| think | qwen7b | py | 10 | 20.0 | 60.0 | 0.0 (94) | – (8) | 0.80 | 3115 | 15574 | 0.00 | 459 | – |
| think | opus | canon->py | 10 | 100.0 | 80.0 | 40.0 (5) | – (10) | 0.20 | 7620 | 7620 | 0.46 | 173 | – |
| think | opus | py | 10 | 100.0 | 100.0 | – (0) | – (10) | 0.00 | 1608 | 1608 | 0.20 | 73 | – |
| think | gpt | canon->py | 10 | 100.0 | 90.0 | 88.9 (9) | – (10) | 0.10 | 4287 | 4287 | 0.10 | 149 | – |
| think | gpt | py | 10 | 100.0 | 100.0 | – (0) | – (10) | 0.00 | 908 | 908 | 0.05 | 58 | – |
