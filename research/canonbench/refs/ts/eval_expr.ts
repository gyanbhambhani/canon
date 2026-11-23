type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function eval_expr(s: string): Result<number> {
  const cs = s.split("").filter((c) => c !== " ");
  let i = 0;
  let divZero = false;
  class SyntaxErr extends Error {}
  const fail = (): never => {
    throw new SyntaxErr(i >= cs.length ? "unexpected end" : "unexpected character: " + cs[i]);
  };
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  function factor(): number {
    if (cs[i] === "(") {
      i++;
      const v = expr();
      if (cs[i] !== ")") fail();
      i++;
      return v;
    }
    if (!isDigit(cs[i])) fail();
    let n = 0;
    while (isDigit(cs[i])) n = n * 10 + Number(cs[i++]);
    return n;
  }
  function term(): number {
    let v = factor();
    while (cs[i] === "*" || cs[i] === "/") {
      const op = cs[i++];
      const r = factor();
      if (op === "*") v = v * r;
      else if (r === 0) {
        divZero = true;
        v = 0;
      } else v = Math.trunc(v / r);
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (cs[i] === "+" || cs[i] === "-") {
      const op = cs[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    if (i < cs.length) fail();
    if (divZero) return { ok: false, error: "division by zero" };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
