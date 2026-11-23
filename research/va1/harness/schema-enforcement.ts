/**
 * Does the schema arm really enforce, on the client, what a schema can state? A probe model carries one
 * of every constraint kind a Pydantic Field can emit as JSON Schema; the generated ajv validator
 * (the arm's client) is compared with the FastAPI server on inputs at and around every edge.
 *   tsx harness/schema-enforcement.ts   -> results/schema-enforcement.json (exit 1 on any disagreement)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { VA1, build, prepare } from "./arms";
import { withServer } from "./hidden";

const dir = prepare("schema", join(VA1, ".work", "schema-enforcement"));
writeFileSync(join(dir, "backend", "models.py"), `from typing import Literal

from pydantic import BaseModel, Field


class Probe(BaseModel):
    s: str = Field(min_length=2, max_length=4)
    word: str = Field(pattern=r"^[A-Z0-9]+$")
    blank: str = Field(pattern=r"[^ \\t\\r\\n]")
    i: int = Field(ge=5, le=10)
    g: int = Field(gt=0, lt=3)
    f: float = Field(ge=0.5, le=2.5)
    m: int = Field(multiple_of=5)
    e: Literal["a", "b"]
    ok: Literal[True]
    tags: list[str] = Field(min_length=1, max_length=3)
`);
writeFileSync(join(dir, "backend", "main.py"), `from fastapi import FastAPI

from errors import install_error_handlers
from models import Probe

app = FastAPI()
install_error_handlers(app)


@app.get("/ping")
def ping() -> dict[str, bool]:
    return {"ok": True}


@app.post("/probe")
def probe(p: Probe) -> Probe:
    return p
`);
const b = build("schema", dir);
if (!b.ok) throw new Error(b.output);

const base = { s: "ab", word: "AB1", blank: "x", i: 5, g: 1, f: 0.5, m: 0, e: "a", ok: true, tags: ["t"] };
const cases: [string, Record<string, unknown>][] = [["valid", {}]];
const vary = (name: string, key: string, values: unknown[]) => values.forEach((v) => cases.push([`${name}=${JSON.stringify(v)}`, { [key]: v }]));
vary("min_length/max_length", "s", ["a", "ab", "abcd", "abcde", "", "😀😀", "😀😀😀😀", "😀😀😀😀😀"]);
vary("pattern", "word", ["A", "a", "AB1", "AB-1", "", "AB1\n"]);
vary("not blank", "blank", ["", " ", "\t \n", " x ", "x"]);
vary("ge/le", "i", [4, 5, 10, 11]);
vary("gt/lt", "g", [0, 1, 2, 3]);
vary("float ge/le", "f", [0.49, 0.5, 2.5, 2.51]);
vary("multiple_of", "m", [0, 5, 10, 4, 7, -5]);
vary("Literal enum", "e", ["a", "b", "c", "A", ""]);
vary("Literal[True]", "ok", [true, false]);
vary("list length", "tags", [[], ["a"], ["a", "b", "c"], ["a", "b", "c", "d"]]);

const mod = await import(pathToFileURL(join(dir, "frontend", "src", "api", "validate.ts")).href);
const rows: { case: string; client: boolean; server: number }[] = [];
const ran = await withServer(dir, async (url) => {
  for (const [name, change] of cases) {
    const input = { ...base, ...change };
    const r = await fetch(`${url}/probe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    rows.push({ case: name, client: mod.validateSchema("Probe", input) === null, server: r.status });
  }
  return true;
});
if (!ran) throw new Error("the probe backend did not start");
const bad = rows.filter((r) => r.client !== (r.server === 200));
mkdirSync(join(VA1, "results"), { recursive: true });
writeFileSync(join(VA1, "results", "schema-enforcement.json"), JSON.stringify({ tool: "openapi-typescript 7.13.0 (types), ajv 8.17.1 (validators)", cases: rows.length, disagreements: bad, rows }, null, 2) + "\n");
console.log(`${rows.length} probe inputs, ${bad.length} disagreements`);
for (const r of bad) console.log(`  ${r.case}: client says ${r.client ? "valid" : "invalid"}, server ${r.server}`);
process.exitCode = bad.length ? 1 : 0;
