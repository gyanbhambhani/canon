# Likelihood study (M8)

Which spelling of each construct does a model find most natural? See `REPORT.md` for results and
`apps/web/content/docs/design-notes.mdx` for the write-up.

- `constructs.py`: 14 constructs; each is written in equivalent spellings inside three small programs.
- `score.py MODEL`: total log-probability of every program under a local Hugging Face model, written to `results/`.
- `report.py`: writes `REPORT.md` and `likelihood.svg`, and copies the chart to `apps/web/public/research/`.

```bash
python3 -m venv research/likelihood/.venv
research/likelihood/.venv/bin/pip install torch transformers accelerate matplotlib
cd research/likelihood
.venv/bin/python score.py Qwen/Qwen2.5-Coder-1.5B   # downloads ~3 GB on first run; no login needed
.venv/bin/python score.py Qwen/Qwen2.5-Coder-7B     # ~15 GB
.venv/bin/python report.py
```

Runs on Apple Silicon (MPS), CUDA or CPU. Scores are deterministic for a given model and torch version.
