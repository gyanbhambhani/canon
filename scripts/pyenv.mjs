// Create .venv with the pinned Python tools in requirements-dev.txt (Python 3.11 or later).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const venv = join(root, ".venv");
const candidates = [process.env.CANON_PYTHON, "python3.12", "python3.13", "python3.11", "python3.14", "python3"].filter(Boolean);
let python = null;
for (const c of candidates) {
  try {
    const v = execFileSync(c, ["-c", "import sys; print(sys.version_info >= (3, 11))"], { encoding: "utf8" }).trim();
    if (v === "True") {
      python = c;
      break;
    }
  } catch {
    // not installed
  }
}
if (!python) {
  console.error("pnpm pyenv: needs Python 3.11 or later on PATH (or CANON_PYTHON=/path/to/python)");
  process.exit(1);
}
if (!existsSync(join(venv, "bin", "python"))) execFileSync(python, ["-m", "venv", venv], { stdio: "inherit" });
execFileSync(join(venv, "bin", "python"), ["-m", "pip", "install", "-q", "-r", join(root, "requirements-dev.txt")], { stdio: "inherit" });
console.log(`pnpm pyenv: .venv ready (${python})`);
