## Scoreboard (main; margin m = 10 points)

Each cell: verdict, Canon minus baseline in percentage points [95% bootstrap interval over seeds], Holm-adjusted p, seeds.

| Family | mlx-community/Qwen2.5-Coder-7B-Instruct-8bit | claude-opus-5-5 | gpt-6.2-sol |
| --- | --- | --- | --- |
| READ | **inconclusive** -3.7 [-10.3, +3.1] p=1.000 n=76 (vs ts) | **non-inferior** -0.5 [-2.0, +0.5] p=1.000 n=76 (vs py) | **win** +3.6 [+1.7, +5.8] p=0.001 n=76 (vs ts) |
| READ-effects | **inconclusive** +6.3 [-10.9, +23.4] p=1.000 n=16 (vs py) | **non-inferior** +0.8 [+0.0, +2.3] p=1.000 n=16 (vs py) | **win** +8.3 [+3.6, +13.5] p=0.001 n=16 (vs ts) |
| READ-property | **inconclusive** -1.9 [-11.5, +7.7] p=1.000 n=52 (vs ts) | **non-inferior** -1.9 [-5.8, +0.0] p=1.000 n=52 (vs py) | **non-inferior** +7.1 [+1.3, +14.1] p=0.130 n=52 (vs ts) |
| READ-output | **non-inferior** +4.2 [-0.8, +10.0] p=0.657 n=60 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) |
| WRITE | **lose** -32.7 [-46.9, -20.4] p=1.000 n=49 (vs ts) | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) |
| FIX | not run | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=53 (vs py) |
| CHANGE | not run | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=24 (vs py) |
| THINK | **lose** -36.7 [-48.3, -25.0] p=1.000 n=60 (vs py) | not run | **non-inferior** -2.8 [-6.7, +0.0] p=1.000 n=60 (vs py) |

### Arm means per cell (seed-averaged, %)

| Family | Model | arms |
| --- | --- | --- |
| READ | qwen7b | canon 35.6, canon-stripped 34.2, py 33.4, ts 39.4 |
| READ | opus | canon 99.3, canon-stripped 99.3, py 99.8, ts 100.0 |
| READ | gpt | canon 99.3, canon-stripped 99.2, py 89.3, ts 95.8 |
| READ-effects | qwen7b | canon 57.8, canon-stripped 46.9, py 51.6, ts 54.7 |
| READ-effects | opus | canon 100.0, canon-stripped 100.0, py 99.2, ts 100.0 |
| READ-effects | gpt | canon 100.0, canon-stripped 99.5, py 75.0, ts 91.7 |
| READ-property | qwen7b | canon 46.2, canon-stripped 50.0, py 48.1, ts 48.1 |
| READ-property | opus | canon 98.1, canon-stripped 98.1, py 100.0, ts 100.0 |
| READ-property | gpt | canon 98.1, canon-stripped 98.1, py 78.8, ts 91.0 |
| READ-output | qwen7b | canon 21.7, canon-stripped 20.0, py 17.5, ts 30.8 |
| READ-output | opus | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| READ-output | gpt | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| WRITE | qwen7b | canon 0.0, py 36.7, ts 32.7 |
| WRITE | gpt | canon 100.0, py 100.0, ts 100.0 |
| FIX | gpt | canon 100.0, py 100.0, ts 100.0 |
| CHANGE | gpt | canon 100.0, py 100.0, ts 100.0 |
| THINK | qwen7b | canon->py 0.0, py 36.7 |
| THINK | gpt | canon->py 97.2, py 100.0 |

### Cost: tokens per item, Canon / baseline

| Family | Model | Baseline | Ratio [95% CI] | Verdict |
| --- | --- | --- | --- | --- |
| read | qwen7b | ts | 6.78 [6.30, 7.32] | lose (more tokens) |
| read | opus | py | 5.74 [5.36, 6.14] | lose (more tokens) |
| read | gpt | ts | 7.66 [7.20, 8.15] | lose (more tokens) |
| write | qwen7b | ts | 17.00 [13.86, 20.14] | lose (more tokens) |
| write | gpt | py | 4.82 [4.55, 5.10] | lose (more tokens) |
| fix | gpt | py | 3.49 [3.27, 3.71] | lose (more tokens) |
| change | gpt | py | 3.23 [2.90, 3.60] | lose (more tokens) |

### Annotation ablation (READ)

| Model | Row | Comparison | Difference [95% CI] | n |
| --- | --- | --- | --- | --- |
| qwen7b | READ | Canon - stripped Canon (value of the annotations) | +1.4 [-3.4, +6.4] | 76 |
| qwen7b | READ | stripped Canon - ts (syntax alone) | -5.2 [-11.3, +1.4] | 76 |
| qwen7b | READ-effects | Canon - stripped Canon (value of the annotations) | +10.9 [-3.1, +23.4] | 16 |
| qwen7b | READ-effects | stripped Canon - py (syntax alone) | -4.7 [-17.2, +7.8] | 16 |
| qwen7b | READ-property | Canon - stripped Canon (value of the annotations) | -3.8 [-11.5, +3.8] | 52 |
| qwen7b | READ-property | stripped Canon - ts (syntax alone) | +1.9 [-5.8, +11.5] | 52 |
| qwen7b | READ-output | Canon - stripped Canon (value of the annotations) | +1.7 [-4.2, +7.5] | 60 |
| qwen7b | READ-output | stripped Canon - py (syntax alone) | +2.5 [-4.2, +9.2] | 60 |
| opus | READ | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 76 |
| opus | READ | stripped Canon - py (syntax alone) | -0.5 [-2.0, +0.5] | 76 |
| opus | READ-effects | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 16 |
| opus | READ-effects | stripped Canon - py (syntax alone) | +0.8 [+0.0, +2.3] | 16 |
| opus | READ-property | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 52 |
| opus | READ-property | stripped Canon - py (syntax alone) | -1.9 [-5.8, +0.0] | 52 |
| opus | READ-output | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 60 |
| opus | READ-output | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 60 |
| gpt | READ | Canon - stripped Canon (value of the annotations) | +0.1 [+0.0, +0.3] | 76 |
| gpt | READ | stripped Canon - ts (syntax alone) | +3.5 [+1.5, +5.8] | 76 |
| gpt | READ-effects | Canon - stripped Canon (value of the annotations) | +0.5 [+0.0, +1.6] | 16 |
| gpt | READ-effects | stripped Canon - ts (syntax alone) | +7.8 [+3.1, +13.0] | 16 |
| gpt | READ-property | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 52 |
| gpt | READ-property | stripped Canon - ts (syntax alone) | +7.1 [+1.3, +14.1] | 52 |
| gpt | READ-output | Canon - stripped Canon (value of the annotations) | +0.0 [+0.0, +0.0] | 60 |
| gpt | READ-output | stripped Canon - py (syntax alone) | +0.0 [+0.0, +0.0] | 60 |

### Per arm: pass rate, first-try check, self-healing, false acceptance, rounds, tokens, cost

| Family | Model | Arm | Runs | Pass % | First check ok % | Self-healing % (errors) | False acceptance % (accepted) | Rounds | Tokens/run | Tokens/pass | USD | Wall s | Regression % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| read | qwen7b | canon | 198 | 42.9 | – | – (0) | – (0) | – | 3273 | 7624 | 0.00 | 1357 | – |
| read | qwen7b | canon-stripped | 198 | 39.9 | – | – (0) | – (0) | – | 3262 | 8176 | 0.00 | 1740 | – |
| read | qwen7b | py | 198 | 39.9 | – | – (0) | – (0) | – | 596 | 1493 | 0.00 | 1693 | – |
| read | qwen7b | ts | 198 | 44.9 | – | – (0) | – (0) | – | 513 | 1141 | 0.00 | 1894 | – |
| read | opus | canon | 594 | 99.5 | – | – (0) | – (0) | – | 4783 | 4807 | 5.80 | 1874 | – |
| read | opus | canon-stripped | 476 | 99.4 | – | – (0) | – (0) | – | 4809 | 4839 | 4.80 | 1711 | – |
| read | opus | py | 396 | 99.7 | – | – (0) | – (0) | – | 940 | 943 | 2.57 | 837 | – |
| read | opus | ts | 396 | 100.0 | – | – (0) | – (0) | – | 796 | 796 | 2.48 | 920 | – |
| read | gpt | canon | 594 | 99.5 | – | – (0) | – (0) | – | 3115 | 3130 | 0.42 | 1026 | – |
| read | gpt | canon-stripped | 594 | 99.3 | – | – (0) | – (0) | – | 3110 | 3131 | 0.39 | 1058 | – |
| read | gpt | py | 594 | 86.4 | – | – (0) | – (0) | – | 551 | 638 | 0.76 | 1113 | – |
| read | gpt | ts | 594 | 94.9 | – | – (0) | – (0) | – | 447 | 471 | 0.63 | 1066 | – |
| write | qwen7b | canon | 60 | 0.0 | 0.0 | 0.0 (240) | – (0) | 3.00 | 16780 | – | 0.00 | 8938 | – |
| write | qwen7b | py | 60 | 36.7 | 75.0 | 0.0 (199) | 57.7 (52) | 0.53 | 2144 | 5847 | 0.00 | 3910 | – |
| write | qwen7b | ts | 49 | 32.7 | 83.7 | 0.0 (60) | 65.2 (46) | 0.31 | 1459 | 4469 | 0.00 | 2941 | – |
| write | gpt | canon | 180 | 100.0 | 93.9 | 77.1 (131) | 0.0 (180) | 0.06 | 3973 | 3973 | 1.42 | 2265 | – |
| write | gpt | py | 180 | 100.0 | 100.0 | – (0) | 0.0 (180) | 0.00 | 834 | 834 | 0.80 | 1055 | – |
| write | gpt | ts | 180 | 100.0 | 100.0 | – (0) | 0.0 (180) | 0.00 | 803 | 803 | 0.82 | 1061 | – |
| fix | gpt | canon | 303 | 100.0 | 99.7 | 33.3 (3) | 0.0 (303) | 0.00 | 3782 | 3782 | 1.53 | 2993 | – |
| fix | gpt | py | 303 | 100.0 | 100.0 | – (0) | 0.0 (303) | 0.00 | 1133 | 1133 | 1.58 | 2150 | – |
| fix | gpt | ts | 303 | 100.0 | 100.0 | – (0) | 0.0 (303) | 0.00 | 988 | 988 | 1.36 | 1671 | – |
| change | gpt | canon | 72 | 100.0 | 100.0 | 100.0 (8) | 0.0 (72) | 0.00 | 3728 | 3728 | 0.42 | 599 | 0.0 |
| change | gpt | py | 72 | 100.0 | 100.0 | – (0) | 0.0 (72) | 0.00 | 1219 | 1219 | 0.46 | 600 | 0.0 |
| change | gpt | ts | 72 | 100.0 | 100.0 | – (0) | 0.0 (72) | 0.00 | 904 | 904 | 0.33 | 399 | 0.0 |
| think | qwen7b | canon->py | 60 | 0.0 | 0.0 | 0.0 (240) | – (0) | 3.00 | 16780 | – | 0.00 | 8938 | – |
| think | qwen7b | py | 60 | 36.7 | 75.0 | 0.0 (199) | – (52) | 0.53 | 2144 | 5847 | 0.00 | 3910 | – |
| think | gpt | canon->py | 180 | 97.2 | 93.9 | 77.1 (131) | – (180) | 0.06 | 3973 | 4087 | 1.42 | 2265 | – |
| think | gpt | py | 180 | 100.0 | 100.0 | – (0) | – (180) | 0.00 | 834 | 834 | 0.80 | 1055 | – |
