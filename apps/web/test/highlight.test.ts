/** The display highlighter reads both surfaces: brace syntax and Canon-Py (v0.4). */
import { describe, expect, it } from "vitest";
import { tokenize } from "../lib/highlight";

const classOf = (src: string, text: string) => tokenize(src).find(([, t]) => t === text)?.[0];

describe("highlighter", () => {
  it("brace syntax", () => {
    const src = 'fn f(x: Int) -> String\n  effects: io\n{\n  let y = try g(x)\n  return ?\n}\n';
    expect(classOf(src, "fn")).toBe("kw");
    expect(classOf(src, "effects")).toBe("mod");
    expect(classOf(src, "Int")).toBe("type");
    expect(classOf(src, "?")).toBe("hole");
  });

  it("Canon-Py", () => {
    const src = "@effects(io)\ndef f(x: int) -> str:\n    y = g(x)?\n    if x is None and True:\n        return 'a'\n    return ...\n";
    expect(classOf(src, "def")).toBe("kw");
    expect(classOf(src, "effects")).toBe("mod");
    expect(classOf(src, "is")).toBe("kw");
    expect(classOf(src, "True")).toBe("lit");
    expect(classOf(src, "'a'")).toBe("str");
    expect(classOf(src, "...")).toBe("hole");
    expect(classOf(src, "?")).toBe("op");
    expect(classOf(src, "g")).toBe("fn");
  });
});
