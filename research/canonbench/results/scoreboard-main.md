## Scoreboard (main; margin m = 10 points)

Each cell: verdict, Canon minus baseline in percentage points [95% bootstrap interval over seeds], Holm-adjusted p, seeds.

| Family | mlx-community/Qwen2.5-Coder-7B-Instruct-8bit | claude-opus-5-5 | gpt-6.2-sol |
| --- | --- | --- | --- |
| READ | **non-inferior** -1.1 [-6.3, +4.2] p=1.000 n=76 (vs ts) | **non-inferior** -0.5 [-2.0, +0.5] p=1.000 n=76 (vs py) | **win** +3.6 [+1.7, +5.8] p=0.001 n=76 (vs ts) |
| READ-effects | **inconclusive** +1.6 [-14.6, +19.3] p=1.000 n=16 (vs py) | **non-inferior** +0.8 [+0.0, +2.3] p=1.000 n=16 (vs py) | **win** +8.3 [+3.6, +13.5] p=0.001 n=16 (vs ts) |
| READ-property | **non-inferior** -0.6 [-8.3, +6.4] p=1.000 n=52 (vs ts) | **non-inferior** -1.9 [-5.8, +0.0] p=1.000 n=52 (vs py) | **non-inferior** +7.1 [+1.3, +14.1] p=0.130 n=52 (vs ts) |
| READ-output | **non-inferior** +4.7 [+0.3, +9.7] p=0.130 n=60 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) |
| WRITE | **lose** -32.8 [-43.9, -22.2] p=1.000 n=60 (vs ts) | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=60 (vs py) |
| FIX | **lose** -29.9 [-42.5, -17.1] p=1.000 n=53 (vs py) | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=53 (vs py) |
| CHANGE | **lose** -35.4 [-58.3, -10.4] p=1.000 n=24 (vs ts) | not run | **non-inferior** +0.0 [+0.0, +0.0] p=1.000 n=24 (vs py) |
| THINK | **lose** -36.1 [-47.2, -25.0] p=1.000 n=60 (vs py) | not run | **non-inferior** -2.8 [-6.7, +0.0] p=1.000 n=60 (vs py) |

### Arm means per cell (seed-averaged, %)

| Family | Model | arms |
| --- | --- | --- |
| READ | qwen7b | canon 36.0, canon-stripped 34.0, py 35.0, ts 37.1 |
| READ | opus | canon 99.3, canon-stripped 99.3, py 99.8, ts 100.0 |
| READ | gpt | canon 99.3, canon-stripped 99.2, py 89.3, ts 95.8 |
| READ-effects | qwen7b | canon 53.6, canon-stripped 45.8, py 52.1, ts 54.2 |
| READ-effects | opus | canon 100.0, canon-stripped 100.0, py 99.2, ts 100.0 |
| READ-effects | gpt | canon 100.0, canon-stripped 99.5, py 75.0, ts 91.7 |
| READ-property | qwen7b | canon 46.8, canon-stripped 48.7, py 50.6, ts 47.4 |
| READ-property | opus | canon 98.1, canon-stripped 98.1, py 100.0, ts 100.0 |
| READ-property | gpt | canon 98.1, canon-stripped 98.1, py 78.8, ts 91.0 |
| READ-output | qwen7b | canon 23.6, canon-stripped 20.8, py 18.9, ts 26.1 |
| READ-output | opus | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| READ-output | gpt | canon 100.0, canon-stripped 100.0, py 100.0, ts 100.0 |
| WRITE | qwen7b | canon 0.0, py 36.1, ts 32.8 |
| WRITE | gpt | canon 100.0, py 100.0, ts 100.0 |
| FIX | qwen7b | canon 50.0, py 79.9, ts 76.6 |
| FIX | gpt | canon 100.0, py 100.0, ts 100.0 |
| CHANGE | qwen7b | canon 35.4, py 58.3, ts 70.8 |
| CHANGE | gpt | canon 100.0, py 100.0, ts 100.0 |
| THINK | qwen7b | canon->py 0.0, py 36.1 |
| THINK | gpt | canon->py 97.2, py 100.0 |

### Cost: tokens per item, Canon / baseline

| Family | Model | Baseline | Ratio [95% CI] | Verdict |
| --- | --- | --- | --- | --- |
| read | qwen7b | ts | 6.84 [6.41, 7.32] | lose (more tokens) |
| read | opus | py | 5.74 [5.36, 6.14] | lose (more tokens) |
| read | gpt | ts | 7.66 [7.20, 8.15] | lose (more tokens) |
| write | qwen7b | ts | 14.05 [11.43, 16.97] | lose (more tokens) |
| write | gpt | py | 4.82 [4.55, 5.10] | lose (more tokens) |
| fix | qwen7b | py | 4.85 [4.27, 5.56] | lose (more tokens) |
| fix | gpt | py | 3.49 [3.27, 3.71] | lose (more tokens) |
| change | qwen7b | ts | 8.59 [5.76, 12.43] | lose (more tokens) |
| change | gpt | py | 3.23 [2.90, 3.60] | lose (more tokens) |

### Annotation ablation (READ)

| Model | Row | Comparison | Difference [95% CI] | n |
| --- | --- | --- | --- | --- |
| qwen7b | READ | Canon - stripped Canon (value of the annotations) | +2.0 [-1.2, +5.5] | 76 |
| qwen7b | READ | stripped Canon - ts (syntax alone) | -3.1 [-7.9, +1.8] | 76 |
| qwen7b | READ-effects | Canon - stripped Canon (value of the annotations) | +7.8 [-2.6, +18.8] | 16 |
| qwen7b | READ-effects | stripped Canon - py (syntax alone) | -6.2 [-17.7, +6.3] | 16 |
| qwen7b | READ-property | Canon - stripped Canon (value of the annotations) | -1.9 [-5.8, +1.3] | 52 |
| qwen7b | READ-property | stripped Canon - ts (syntax alone) | +1.3 [-4.5, +7.1] | 52 |
| qwen7b | READ-output | Canon - stripped Canon (value of the annotations) | +2.8 [-1.1, +6.9] | 60 |
| qwen7b | READ-output | stripped Canon - py (syntax alone) | +1.9 [-3.3, +7.8] | 60 |
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
| read | qwen7b | canon | 594 | 42.8 | – | – (0) | – (0) | – | 3272 | 7651 | 0.00 | 6671 | – |
| read | qwen7b | canon-stripped | 594 | 39.6 | – | – (0) | – (0) | – | 3262 | 8246 | 0.00 | 7066 | – |
| read | qwen7b | py | 594 | 41.6 | – | – (0) | – (0) | – | 605 | 1456 | 0.00 | 7174 | – |
| read | qwen7b | ts | 594 | 43.1 | – | – (0) | – (0) | – | 507 | 1175 | 0.00 | 6555 | – |
| read | opus | canon | 594 | 99.5 | – | – (0) | – (0) | – | 4783 | 4807 | 5.80 | 1874 | – |
| read | opus | canon-stripped | 476 | 99.4 | – | – (0) | – (0) | – | 4809 | 4839 | 4.80 | 1711 | – |
| read | opus | py | 396 | 99.7 | – | – (0) | – (0) | – | 940 | 943 | 2.57 | 837 | – |
| read | opus | ts | 396 | 100.0 | – | – (0) | – (0) | – | 796 | 796 | 2.48 | 920 | – |
| read | gpt | canon | 594 | 99.5 | – | – (0) | – (0) | – | 3115 | 3130 | 0.42 | 1026 | – |
| read | gpt | canon-stripped | 594 | 99.3 | – | – (0) | – (0) | – | 3110 | 3131 | 0.39 | 1058 | – |
| read | gpt | py | 594 | 86.4 | – | – (0) | – (0) | – | 551 | 638 | 0.76 | 1113 | – |
| read | gpt | ts | 594 | 94.9 | – | – (0) | – (0) | – | 447 | 471 | 0.63 | 1066 | – |
| write | qwen7b | canon | 180 | 0.0 | 0.0 | 0.0 (720) | – (0) | 3.00 | 16951 | – | 0.00 | 27780 | – |
| write | qwen7b | py | 180 | 36.1 | 75.0 | 0.0 (554) | 59.4 (160) | 0.51 | 2100 | 5815 | 0.00 | 10191 | – |
| write | qwen7b | ts | 180 | 32.8 | 76.1 | 0.0 (327) | 63.6 (162) | 0.47 | 1871 | 5709 | 0.00 | 10210 | – |
| write | gpt | canon | 180 | 100.0 | 93.9 | 77.1 (131) | 0.0 (180) | 0.06 | 3973 | 3973 | 1.42 | 2265 | – |
| write | gpt | py | 180 | 100.0 | 100.0 | – (0) | 0.0 (180) | 0.00 | 834 | 834 | 0.80 | 1055 | – |
| write | gpt | ts | 180 | 100.0 | 100.0 | – (0) | 0.0 (180) | 0.00 | 803 | 803 | 0.82 | 1061 | – |
| fix | qwen7b | canon | 250 | 48.8 | 72.8 | 2.5 (354) | 41.9 (210) | 0.59 | 6681 | 13692 | 0.00 | 14515 | – |
| fix | qwen7b | py | 251 | 80.5 | 99.2 | 0.0 (8) | 19.5 (251) | 0.01 | 1198 | 1488 | 0.00 | 9855 | – |
| fix | qwen7b | ts | 251 | 76.9 | 99.6 | 0.0 (5) | 23.1 (251) | 0.00 | 1029 | 1338 | 0.00 | 8916 | – |
| fix | gpt | canon | 303 | 100.0 | 99.7 | 33.3 (3) | 0.0 (303) | 0.00 | 3782 | 3782 | 1.53 | 2993 | – |
| fix | gpt | py | 303 | 100.0 | 100.0 | – (0) | 0.0 (303) | 0.00 | 1133 | 1133 | 1.58 | 2150 | – |
| fix | gpt | ts | 303 | 100.0 | 100.0 | – (0) | 0.0 (303) | 0.00 | 988 | 988 | 1.36 | 1671 | – |
| change | qwen7b | canon | 48 | 35.4 | 41.7 | 5.5 (164) | 26.1 (23) | 1.63 | 11575 | 32683 | 0.00 | 6082 | 4.3 |
| change | qwen7b | py | 48 | 58.3 | 89.6 | 0.0 (16) | 39.1 (46) | 0.19 | 1837 | 3149 | 0.00 | 2839 | 4.3 |
| change | qwen7b | ts | 48 | 70.8 | 89.6 | 0.0 (23) | 26.1 (46) | 0.19 | 1288 | 1818 | 0.00 | 2281 | 4.3 |
| change | gpt | canon | 72 | 100.0 | 100.0 | 100.0 (8) | 0.0 (72) | 0.00 | 3728 | 3728 | 0.42 | 599 | 0.0 |
| change | gpt | py | 72 | 100.0 | 100.0 | – (0) | 0.0 (72) | 0.00 | 1219 | 1219 | 0.46 | 600 | 0.0 |
| change | gpt | ts | 72 | 100.0 | 100.0 | – (0) | 0.0 (72) | 0.00 | 904 | 904 | 0.33 | 399 | 0.0 |
| think | qwen7b | canon->py | 180 | 0.0 | 0.0 | 0.0 (720) | – (0) | 3.00 | 16951 | – | 0.00 | 27780 | – |
| think | qwen7b | py | 180 | 36.1 | 75.0 | 0.0 (554) | – (160) | 0.51 | 2100 | 5815 | 0.00 | 10191 | – |
| think | gpt | canon->py | 180 | 97.2 | 93.9 | 77.1 (131) | – (180) | 0.06 | 3973 | 4087 | 1.42 | 2265 | – |
| think | gpt | py | 180 | 100.0 | 100.0 | – (0) | – (180) | 0.00 | 834 | 834 | 0.80 | 1055 | – |
