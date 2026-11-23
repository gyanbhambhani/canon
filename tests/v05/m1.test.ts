/**
 * v0.5 M1 acceptance: projects and modules. canon.toml, check and test across a multi-file
 * project, explicit named imports in both surfaces, M002 (cycle), M003 (unknown or unimported
 * name), M004 (a top-level name defined twice in a project), and import order in canonical form.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyPatch, check, checkProject, ConfigError, fmt, moduleName, readConfig, type ModuleSource } from "@canon/compiler";

const root = join(__dirname, "..", "..");
const bin = join(root, "packages", "cli", "dist", "index.js");
const fixtures = join(__dirname, "projects");

function canon(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

function copyFixture(name: string): string {
  const d = mkdtempSync(join(tmpdir(), "canon-proj-"));
  cpSync(join(fixtures, name), d, { recursive: true });
  return d;
}

const mod = (name: string, src: string): ModuleSource => ({ name, path: `canon/${name.replace(/\./g, "/")}.cn`, src });
const codes = (r: ReturnType<typeof checkProject>, name: string) =>
  r.modules.find((m) => m.name === name)!.result.diagnostics.map((d) => d.code);

const MONEY = `type Money {
  cents: Int,
}

type Tender =
  | Card(last4: String)
  | Cash

fn add(a: Money, b: Money) -> Money {
  return Money { cents: a.cents + b.cents }
}
`;

describe("canon.toml", () => {
  it("reads the project, backend and frontend sections with defaults", () => {
    const c = readConfig(`# a comment\n[project]\nname = "todos"\n\n[backend]\ntarget = "fastapi"\nout = "backend/canon_generated"\n\n[frontend]\ntarget = "ts-client"\nout = "frontend/src/canon"\n`);
    expect(c).toEqual({
      project: { name: "todos", src: "canon" },
      backend: { target: "fastapi", out: "backend/canon_generated" },
      frontend: { target: "ts-client", out: "frontend/src/canon" },
    });
    expect(readConfig(`[project]\nname = "x"\nsrc = "src" # inline comment\n`)).toEqual({ project: { name: "x", src: "src" }, backend: null, frontend: null });
  });

  it("rejects unknown sections, unknown keys, bad values and a missing name, naming the problem", () => {
    const bad = (t: string, msg: RegExp) => expect(() => readConfig(t)).toThrow(msg);
    bad(`[project]\nname = "x"\n[db]\nurl = "y"\n`, /unknown section \[db\]/);
    bad(`[project]\nname = "x"\nsrcs = "y"\n`, /unknown key srcs/);
    bad(`[project]\nname = x\n`, /canon\.toml:2/);
    bad(`[project]\nsrc = "y"\n`, /needs name/);
    bad(`[project]\nname = "x"\n[backend]\ntarget = "django"\n`, /fastapi/);
    expect(() => readConfig(`name = "x"\n`)).toThrow(ConfigError);
  });

  it("names modules by their path under the source folder", () => {
    expect(moduleName("billing/invoices.cn")).toBe("billing.invoices");
    expect(moduleName("todos.cn")).toBe("todos");
  });
});

describe("check and test across a project", () => {
  for (const [name, flags] of [["money", []], ["money_py", ["--syntax", "py"]]] as const) {
    it(`${name}: canon check with no file checks every module`, () => {
      const r = canon(["check", ...flags], join(fixtures, name));
      expect(r.err).toBe("");
      expect(r.out).toBe("canon/billing/money.cn: ok\ncanon/shop.cn: ok\n");
      expect(r.code).toBe(0);
    });

    it(`${name}: canon test runs the tests of every module`, () => {
      const r = canon(["test", ...flags], join(fixtures, name));
      expect(r.out).toBe("PASS add\nPASS receipt\n2 passed, 0 failed\n");
      expect(r.code).toBe(0);
    });
  }

  it("a file inside the project is checked with its imports; --json reports per file", () => {
    const r = canon(["check", "canon/shop.cn", "--json"], join(fixtures, "money"));
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toMatchObject({ ok: true, diagnostics: [] });
  });

  it("an error in one module is reported in that module's file, and the exit code is 1", () => {
    const d = copyFixture("money");
    const f = join(d, "canon", "shop.cn");
    writeFileSync(f, readFileSync(f, "utf8").replace("fold(xs, Money { cents: 0 }, add)", "fold(xs, 0, add)"));
    const r = canon(["check"], d);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^canon\/billing\/money\.cn: ok\ncanon\/shop\.cn:4:\d+: error T001/);
  });

  it("check --fix --write applies mechanical patches in every module", () => {
    const d = copyFixture("money");
    const f = join(d, "canon", "shop.cn");
    writeFileSync(f, readFileSync(f, "utf8").replace("use billing.money.{Money, Tender, add, label}", "use billing.money.{label,add, Tender,Money}"));
    const r = canon(["check", "--fix", "--write"], d);
    expect(r.code).toBe(0);
    expect(r.out).toContain("canon/shop.cn: applied C001");
    expect(readFileSync(f, "utf8")).toBe(readFileSync(join(fixtures, "money", "canon", "shop.cn"), "utf8"));
  });

  it("with no file and no canon.toml, check is a usage error", () => {
    const r = canon(["check"], mkdtempSync(join(tmpdir(), "canon-none-")));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/needs a file, or a project/);
  });

  it("a single file with no canon.toml is still a program; a project import there is M001", () => {
    expect(check("fn main() -> Unit {\n  print(\"hi\")\n}\n", "main.cn").ok).toBe(false); // print needs io
    const r = check("use todos.{Todo}\n\nfn main() -> Unit {}\n", "main.cn");
    expect(r.diagnostics[0].code).toBe("M001");
    expect(r.diagnostics[0].message).toMatch(/needs a project/);
  });
});

describe("named imports", () => {
  it("work in both surfaces and say the same thing", () => {
    const brace = "use billing.money.{Money, add}\n\nfn twice(m: Money) -> Money {\n  return add(m, m)\n}\n";
    const py = "from billing.money import Money, add\n\ndef twice(m: Money) -> Money:\n    return add(m, m)\n";
    expect(fmt(brace, { features: { py: true } })).toBe(py);
    expect(fmt(py)).toBe(brace);
    for (const [src, py_] of [[brace, false], [py, true]] as const) {
      const r = checkProject([mod("billing.money", fmt(MONEY, { features: { py: py_ } })), mod("shop", src)], { features: { py: py_ } });
      expect(r.modules.map((m) => m.result.diagnostics)).toEqual([[], []]);
    }
  });

  it("modules are ordered dependencies first", () => {
    const r = checkProject([mod("shop", "use billing.money.{Money}\n\nfn zero() -> Money {\n  return Money { cents: 0 }\n}\n"), mod("billing.money", MONEY)]);
    expect(r.modules.map((m) => m.name)).toEqual(["billing.money", "shop"]);
  });

  it("importing a sum type brings its variants", () => {
    const r = checkProject([mod("billing.money", MONEY), mod("shop", "use billing.money.{Tender}\n\nfn pay() -> Tender {\n  return Card(\"4242\")\n}\n")]);
    expect(r.ok).toBe(true);
  });

  it("canonical form sorts import lines by module and the names inside each, and merges duplicates", () => {
    const src = "use std.text\nuse zoo.{b, A}\nuse billing.money.{add}\nuse billing.money.{Money, add}\n\nfn f() -> Unit {}\n";
    expect(fmt(src)).toBe("use billing.money.{Money, add}\nuse std.text\nuse zoo.{A, b}\n\nfn f() -> Unit {}\n");
  });

  it("fuzzed import orders collapse to one text", () => {
    const lines = [["billing.money", ["Money", "add", "Tender"]], ["catalog", ["Product", "price_of"]], ["users.accounts", ["User"]]] as const;
    let seed = 2026;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const shuffle = <T,>(xs: readonly T[]): T[] => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const texts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const sp = () => (rand() < 0.5 ? "" : " ");
      const uses = shuffle(lines).map(([m, ns]) => `use ${m}.{${sp()}${shuffle(ns).join(`,${sp()}`)}${rand() < 0.3 ? "," : ""}${sp()}}`);
      if (rand() < 0.3) uses.push(uses[0]); // a duplicate line
      const py = rand() < 0.5;
      const src = uses.join("\n") + "\n\nfn f() -> Unit {}\n";
      texts.add(fmt(py ? fmt(src, { features: { py: true } }) : src));
    }
    expect([...texts]).toEqual(["use billing.money.{Money, Tender, add}\nuse catalog.{Product, price_of}\nuse users.accounts.{User}\n\nfn f() -> Unit {}\n"]);
  });

  it("Canon-Py has no wildcards, renaming or from-imports of std", () => {
    for (const [src, msg] of [
      ["from todos import *\n", /no wildcards/],
      ["from todos import Todo as T\n", /do not rename/],
      ["from std import text\n", /import std\.name/],
    ] as const) {
      expect(() => fmt(src, { features: { py: true } })).toThrow(msg);
    }
  });
});

describe("M002: import cycles", () => {
  it("reports the cycle in every module on it", () => {
    const r = checkProject([
      mod("a", "use b.{g}\n\nfn f() -> Int {\n  return g()\n}\n"),
      mod("b", "use c.{h}\n\nfn g() -> Int {\n  return h()\n}\n"),
      mod("c", "use a.{f}\n\nfn h() -> Int {\n  return 1\n}\n\nfn k() -> Int {\n  return f()\n}\n"),
    ]);
    for (const m of r.modules) {
      const d = m.result.diagnostics.find((x) => x.code === "M002")!;
      expect(d.message).toBe("import cycle: a -> b -> c -> a; move the shared items into a module both can import");
      expect(d.line).toBe(1);
    }
    expect(r.ok).toBe(false);
  });

  it("a module importing itself is a cycle", () => {
    const r = checkProject([mod("a", "use a.{f}\n\nfn f() -> Int {\n  return 1\n}\n")]);
    expect(codes(r, "a")).toContain("M002");
  });

  it("two modules importing each other", () => {
    const r = checkProject([mod("x", "use y.{Y}\n\ntype X {\n  y: Y,\n}\n"), mod("y", "use x.{X}\n\ntype Y {\n  n: Int,\n}\n\nfn f(x: X) -> Int {\n  return x.y.n\n}\n")]);
    expect(codes(r, "x")).toEqual(["M002"]);
    expect(codes(r, "y")).toEqual(["M002"]);
  });
});

describe("M003: unknown and unimported names", () => {
  it("an unknown module, an unknown name, and a variant imported by name", () => {
    const r = checkProject([mod("billing.money", MONEY), mod("shop", "use billing.cash.{Coin}\nuse billing.money.{Cash, Money, Nope}\n\nfn f() -> Unit {}\n")]);
    const msgs = r.modules.find((m) => m.name === "shop")!.result.diagnostics.map((d) => [d.code, d.message]);
    expect(msgs).toEqual([
      ["M003", "no module billing.cash in this project; modules are billing.money, shop"],
      ["M003", "Cash is a variant of Tender; import the type: use billing.money.{Tender}"],
      ["M003", "module billing.money has no top-level item Nope"],
    ]);
  });

  it("a function used without importing it is M003, with a patch that adds the import", () => {
    const src = "use billing.money.{Money}\n\nfn twice(m: Money) -> Money {\n  return add(m, m)\n}\n";
    const r = checkProject([mod("billing.money", MONEY), mod("shop", src)]);
    const ds = r.modules.find((m) => m.name === "shop")!.result.diagnostics;
    expect(ds.map((d) => d.code)).toEqual(["M003"]);
    expect(ds[0].message).toBe("fn add is defined in module billing.money; import it: use billing.money.{add}");
    const fixed = applyPatch(src, ds[0].fix!.diff)!;
    expect(fixed).toBe(src.replace("{Money}", "{Money, add}"));
    expect(checkProject([mod("billing.money", MONEY), mod("shop", fixed)]).ok).toBe(true);
  });

  it("a type reached only through an import's signature is not visible; the patch adds a new import line", () => {
    const src = "use billing.money.{add}\n\nfn zero() -> Money {\n  return Money { cents: 0 }\n}\n";
    const r = checkProject([mod("billing.money", MONEY), mod("shop", src)]);
    const ds = r.modules.find((m) => m.name === "shop")!.result.diagnostics;
    expect(ds.map((d) => d.code)).toEqual(["M003"]);
    expect(applyPatch(src, ds[0].fix!.diff)).toBe(src.replace("{add}", "{Money, add}"));
  });

  it("a variant used without importing its type", () => {
    const src = "fn pay() -> String {\n  return match Cash {\n    _ => \"x\",\n  }\n}\n";
    const r = checkProject([mod("billing.money", MONEY), mod("shop", src)]);
    const ds = r.modules.find((m) => m.name === "shop")!.result.diagnostics;
    expect(ds[0].code).toBe("M003");
    expect(ds[0].message).toMatch(/variant Cash .*use billing\.money\.\{Tender\}/);
    expect(applyPatch(src, ds[0].fix!.diff)).toBe("use billing.money.{Tender}\n\n" + src);
  });
});

describe("M004: top-level names are unique across a project", () => {
  it("a function, a type and a variant defined in two modules", () => {
    const r = checkProject([
      mod("billing.money", MONEY),
      mod("shop", "type Money {\n  n: Int,\n}\n\ntype Pay =\n  | Cash\n\nfn add(a: Int) -> Int {\n  return a\n}\n"),
    ]);
    const msgs = r.modules.find((m) => m.name === "shop")!.result.diagnostics.filter((d) => d.code === "M004").map((d) => d.message);
    expect(msgs).toEqual([
      "type Money is already defined in module billing.money; top-level names are unique across a project",
      "variant Cash is already defined in module billing.money; top-level names are unique across a project",
      "fn add is already defined in module billing.money; top-level names are unique across a project",
    ]);
    expect(codes(r, "billing.money")).toEqual([]);
  });
});
