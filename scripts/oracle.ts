/**
 * Regenerate tests/conformance expectations from the Python oracle.
 *
 * For every tests/conformance/NAME.cn:
 *   NAME.diag.json  the JSON printed by `python3 reference/canon.py check NAME.cn`
 *   NAME.fmt.cn     the output of `python3 reference/canon.py fmt NAME.cn`, only when fmt succeeds
 *
 * The reference examples are copied in first as ref_*.cn so the corpus always holds them.
 * Paths passed to the oracle are repo-relative, so patch headers read a/tests/conformance/NAME.cn.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const corpus = join(root, "tests", "conformance");
const python = process.env.PYTHON ?? "python3";

function oracle(cmd: "check" | "fmt", file: string) {
  const r = spawnSync(python, [join("reference", "canon.py"), cmd, relative(root, file)], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (r.error) throw r.error;
  if (r.stderr && r.stderr.includes("Traceback")) {
    throw new Error(`oracle crashed on ${file}:\n${r.stderr}`);
  }
  return r;
}

for (const f of readdirSync(join(root, "reference", "examples"))) {
  if (f.endsWith(".cn")) copyFileSync(join(root, "reference", "examples", f), join(corpus, `ref_${f}`));
}

const inputs = readdirSync(corpus)
  .filter((f) => f.endsWith(".cn") && !f.endsWith(".fmt.cn"))
  .sort();

let n = 0;
for (const f of inputs) {
  const file = join(corpus, f);
  const base = file.slice(0, -3);
  const check = oracle("check", file);
  writeFileSync(`${base}.diag.json`, check.stdout);
  const fmt = oracle("fmt", file);
  if (fmt.status === 0) {
    writeFileSync(`${base}.fmt.cn`, fmt.stdout);
  } else if (existsSync(`${base}.fmt.cn`)) {
    rmSync(`${base}.fmt.cn`);
  }
  n++;
}
console.log(`oracle: regenerated expectations for ${n} conformance files`);
