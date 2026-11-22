/**
 * Fuzzing helpers (ported from reference/test_canon.py): print a program with random
 * structural noise, then re-join its tokens with random whitespace. Every variant must
 * format back to the original canonical text.
 */
import { lex } from "./lexer.js";
import { normalize } from "./normalize.js";
import { parse } from "./parser.js";
import { Printer } from "./printer.js";

export interface Rng {
  random(): number;
  int(lo: number, hi: number): number;
  choice<T>(xs: T[]): T;
}

/** mulberry32: a small seeded PRNG. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    random,
    int: (lo, hi) => lo + Math.floor(random() * (hi - lo + 1)),
    choice: (xs) => xs[Math.floor(random() * xs.length)],
  };
}

const WILD_SPACES = [" ", "  ", "\n", "\t", " \n    ", "\n\n"];

/** Re-join the token stream with random whitespace (comments keep their own line). */
export function whitespaceFuzz(src: string, r: Rng, spaces: string[] = WILD_SPACES): string {
  const toks = lex(src);
  const out: string[] = [];
  for (let i = 0; i < toks.length - 1; i++) {
    const t = toks[i];
    const nxt = toks[i + 1];
    out.push(t.text);
    if (t.kind === "comment") out.push("\n".repeat(r.int(1, 3)));
    else if (nxt.kind === "op" && nxt.text === "(") {
      // the one line-sensitive rule: keep a '(' on, or off, its previous line
      if (nxt.line === t.line) out.push(r.choice(["", " ", "  ", "\t"]));
      else out.push(r.choice(["\n", "\n\n", " \n    "]));
    } else out.push(r.choice(spaces));
  }
  return out.join("");
}

/** Print the same tree with random extra parens, pipeline-or-call choices and commas. */
export function astNoise(src: string, r: Rng): string {
  return new Printer(r).program(normalize(parse(src)));
}

export function fuzzVariant(src: string, r: Rng, spaces?: string[]): string {
  return whitespaceFuzz(astNoise(src, r), r, spaces);
}
