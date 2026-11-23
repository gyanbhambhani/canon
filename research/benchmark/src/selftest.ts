/** Harness self-test: known-good solutions must pass, known-bad ones must fail. No API calls. */
import { canon, typescript, type Language } from "./languages.js";
import { TASKS } from "./tasks.js";

const task = (id: string) => TASKS.find((t) => t.id === id)!;
let failures = 0;
function expect(lang: Language, id: string, code: string, wantOk: boolean, wantPass: boolean) {
  const c = lang.check(code);
  const r = c.ok ? lang.test(code, task(id)) : { passed: 0, total: task(id).tests.length };
  const pass = r.passed === r.total;
  const good = c.ok === wantOk && pass === wantPass;
  if (!good) failures++;
  console.log(`${good ? "ok  " : "FAIL"} ${lang.id} ${id}: check=${c.ok} tests=${r.passed}/${r.total} ${"error" in r && r.error ? r.error : ""} ${c.ok ? "" : c.codes.join(",")}`);
}

expect(canon, "sum_evens", "fn sum_evens(xs: List[Int]) -> Int {\n  return sum(filter(xs, |x| x % 2 == 0))\n}\n", true, true);
expect(canon, "max_or_none", "fn max_or_none(xs: List[Int]) -> Option[Int] {\n  return first(sort_desc_by(xs, |x| x))\n}\n", true, true);
expect(canon, "min_max", "fn min_max(xs: List[Int]) -> Option[(Int, Int)] {\n  let s = sort_by(xs, |x| x)\n  let r = match (first(s), last(s)) {\n    (Some(a), Some(b)) => Some((a, b)),\n    _ => None,\n  }\n  return r\n}\n", true, true);
expect(canon, "average", "fn average(xs: List[Float]) -> Float {\n  if len(xs) == 0 {\n    return 0.0\n  }\n  return sum_float(xs) / to_float(len(xs))\n}\n", true, true);
expect(canon, "reverse_words", 'fn reverse_words(s: String) -> String {\n  return s\n    |> split(" ")\n    |> reverse()\n    |> join(" ")\n}\n', true, true);
expect(canon, "sum_evens", "fn sum_evens(xs: List[Int]) -> Int {\n  return sum(xs)\n}\n", true, false);
expect(canon, "sum_evens", "fn sum_evens(xs: List[Int]) -> Int {\n  var i = 0\n  while i >= 0 {\n    i = i + 1\n    i = i - 1\n  }\n  return i\n}\n", true, false);
expect(canon, "sum_evens", "fn sum_evens(xs: List[Int]) -> Int {\n  return \"no\"\n}\n", false, false);

expect(typescript, "sum_evens", "export function sum_evens(xs: number[]): number {\n  return xs.filter((x) => x % 2 === 0).reduce((a, b) => a + b, 0);\n}\n", true, true);
expect(typescript, "max_or_none", "export function max_or_none(xs: number[]): number | null {\n  return xs.length ? Math.max(...xs) : null;\n}\n", true, true);
expect(typescript, "min_max", "export function min_max(xs: number[]): [number, number] | null {\n  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;\n}\n", true, true);
expect(typescript, "sum_evens", "export function sum_evens(xs: number[]): number {\n  while (true) {}\n}\n", true, false);
expect(typescript, "sum_evens", "export function sum_evens(xs: number[]): number {\n  return 'no';\n}\n", false, false);

expect(canon, "apply_ops", task("apply_ops").decls!.canon + "\n\nfn apply_ops(balance: Int, ops: List[Op]) -> Result[Int, String] {\n  var b = balance\n  for pair in enumerate(ops) {\n    let step = match pair.1 {\n      Deposit(a) => a,\n      Withdraw(a) => -a,\n    }\n    if b + step < 0 {\n      return Err(\"insufficient funds at step \" + to_string(pair.0 + 1))\n    }\n    b = b + step\n  }\n  return Ok(b)\n}\n", true, true);
expect(canon, "validate_user", task("validate_user").decls!.canon + "\n\nfn validate_user(u: User) -> List[String] {\n  var out = []\n  if u.name == \"\" {\n    out = append(out, \"name is empty\")\n  }\n  if u.age < 0 || u.age > 150 {\n    out = append(out, \"age out of range\")\n  }\n  if len(split(u.email, \"@\")) < 2 {\n    out = append(out, \"email must contain @\")\n  }\n  return out\n}\n", true, true);
expect(canon, "total_area", task("total_area").decls!.canon + "\n\nfn total_area(shapes: List[Shape]) -> Float {\n  return sum_float(map(shapes, |s| area(s)))\n}\n\nfn area(s: Shape) -> Float {\n  return match s {\n    Circle(r) => 3.14159 * r * r,\n    Rect(w, h) => w * h,\n    Triangle(b, h) => b * h / 2.0,\n  }\n}\n", true, true);
expect(typescript, "apply_ops", task("apply_ops").decls!.ts + "\n\nexport function apply_ops(balance: number, ops: Op[]): Result<number> {\n  for (let i = 0; i < ops.length; i++) {\n    const o = ops[i];\n    if (o.kind === \"Withdraw\" && o.amount > balance) return { ok: false, error: `insufficient funds at step ${i + 1}` };\n    balance += o.kind === \"Deposit\" ? o.amount : -o.amount;\n  }\n  return { ok: true, value: balance };\n}\n", true, true);
expect(typescript, "restock", task("restock").decls!.ts + "\n\nexport function restock(items: Item[]): string[] {\n  return items.filter((i) => i.qty < i.min).sort((a, b) => (b.min - b.qty) - (a.min - a.qty)).map((i) => i.sku);\n}\n", true, true);

console.log(failures ? `${failures} self-test failures` : "self-test passed");
process.exit(failures ? 1 : 0);
