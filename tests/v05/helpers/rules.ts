/** Random portable validation rules (A003's subset), for the client and parity tests. */
import { fmt, type ModuleSource } from "@canon/compiler";

/** Random portable rules over GET (a, b, s, o) and POST (a, input) endpoints. */
export function randomRules(seed: number, count: number): ModuleSource[] {
  let x = seed;
  const r = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  const lit = () => String(Math.floor(r() * 14) - 3);
  const intE = (d: number, post: boolean): string => {
    if (d <= 0 || r() < 0.35) return pick(post ? ["a", "input.n", lit(), "len(input.tags)", "str_len(input.title)"] : ["a", lit(), "str_len(s)", "str_len(trim(s))"]);
    const k = String(Math.floor(r() * 4) + 1);
    switch (Math.floor(r() * 5)) {
      case 0: return `(${intE(d - 1, post)} ${pick(["+", "-", "*"])} ${intE(d - 1, post)})`;
      case 1: return `(${intE(d - 1, post)} / ${pick([k, `-${k}`])})`;
      case 2: return `(${intE(d - 1, post)} % ${k})`;
      case 3: return `(-${intE(d - 1, post)})`;
      default: return `(${intE(d - 1, post)} ${pick(["+", "*"])} ${intE(d - 1, post)} ${pick(["-", "%"])} ${k})`;
    }
  };
  const boolE = (d: number, post: boolean): string => {
    if (d <= 0 || r() < 0.3) {
      const cmp = pick(["<", "<=", ">", ">=", "==", "!="]);
      const g = post
        ? [`${intE(1, true)} ${cmp} ${intE(1, true)}`, `contains(input.tags, ${pick(['"a"', '""', '"x y"'])})`, `input.title == ${pick(['"a"', '"it\'s"', '"say \\"hi\\""'])}`,
          `is_email(input.title)`, `input.tags == ["a"]`, `input.ok`, `str_len(trim(input.title)) ${cmp} ${lit()}`, `input.title ${pick(["<", ">="])} "m"`]
        : [`${intE(1, false)} ${cmp} ${intE(1, false)}`, `b ${cmp} ${pick(["0.5", "2.0", "(b * 2.0)", "-1.5"])}`, `(b / 2.0) ${cmp} 0.25`, `is_some(o)`, `is_email(s)`,
          `contains(["a", "b"], s)`, `s ${pick(["<", "<=", ">", ">=", "==", "!="])} ${pick(['"m"', '"ab"', '"😀"'])}`];
      return pick(g);
    }
    switch (Math.floor(r() * 3)) {
      case 0: return `(${boolE(d - 1, post)} && ${boolE(d - 1, post)})`;
      case 1: return `(${boolE(d - 1, post)} || ${boolE(d - 1, post)})`;
      default: return `!(${boolE(d - 1, post)})`;
    }
  };
  const fns: string[] = [];
  for (let i = 0; fns.length < count; i++) {
    const post = i % 2 === 1;
    const rule = boolE(3, post);
    const src = post
      ? `api fn p${i}(a: Int, input: Payload) -> Int\n  route: POST "/p${i}/{a}"\n  requires: ${rule}\n{\n  return a\n}\n`
      : `api fn g${i}(a: Int, b: Float, s: String, o: Option[Int]) -> Int\n  route: GET "/g${i}"\n  requires: ${rule}\n{\n  return a\n}\n`;
    let text: string;
    try {
      text = fmt(src);
    } catch {
      continue;
    }
    if (text.split("\n").some((l) => l.length > 100)) continue;
    fns.push(text);
  }
  const payload = "type Payload {\n  title: String,\n  tags: List[String],\n  n: Int,\n  ok: Bool,\n}\n";
  return [{ name: "rules", path: "canon/rules.cn", src: fmt(payload + "\n" + fns.join("\n")) }];
}

