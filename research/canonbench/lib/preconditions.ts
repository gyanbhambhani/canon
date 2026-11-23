/**
 * Input constraints that seed specs state in words ("grid is a rectangle", "coins holds positive
 * values", "n is never negative"...). Fuzzed inputs that break them are outside the spec, so the
 * references may legitimately differ there; equivalence checks and READ ground truth only use
 * inputs that satisfy them. Each predicate quotes the spec sentence it encodes.
 * Two constraints are CanonBench additions, recorded in DECISIONS.md: money amounts are not
 * negative (invoice_total, payroll_by_dept), and Int results stay in Canon's 53-bit range
 * (stack_vm), because the specs say "rounded down" and the three languages' division of negative
 * numbers is exactly the kind of difference the hidden tests never exercised.
 */
type Args = unknown[];
type Rec = Record<string, unknown>;

const rect = (rows: unknown[]) => rows.every((r) => (r as { length: number }).length === (rows[0] as { length: number })?.length);
const cellsOk = (rows: string[], ok: string) => rows.every((r) => [...r].every((c) => ok.includes(c)));

export const PRECONDITIONS: Record<string, (a: Args) => boolean> = {
  // "grid is a rectangle of rows of equal length made of "#" (land) and "." (water)"
  count_islands: ([g]) => rect(g as string[]) && cellsOk(g as string[], "#."),
  // "grid is a rectangle of rows of equal length", "steps >= 0"
  life_step: ([g, n]) => rect(g as string[]) && cellsOk(g as string[], "#.") && (n as number) >= 0 && (n as number) <= 50,
  // "m is a rectangular matrix"
  spiral_order: ([m]) => rect(m as unknown[]),
  // "board is 3 rows of 3 characters, each "X", "O" or ".""
  tic_tac_toe: ([b]) => (b as string[]).length === 3 && (b as string[]).every((r) => r.length === 3) && cellsOk(b as string[], "XO."),
  // "code is a non-empty string of decimal digits", "Digit(d) appends the digit d (0-9)"
  door_lock: ([code, ev]) => /^[0-9]+$/.test(code as string) && (ev as Rec[]).every((e) => e.kind !== "Digit" || ((e.d as number) >= 0 && (e.d as number) <= 9)),
  // "skus in stock are distinct and quantities are at least 0"
  inventory_ledger: ([stock]) => new Set((stock as Rec[]).map((s) => s.sku)).size === (stock as Rec[]).length && (stock as Rec[]).every((s) => (s.qty as number) >= 0),
  // CanonBench addition: money amounts are not negative (also settle_debts)
  invoice_total: ([lines]) => (lines as Rec[]).every((l) => (l.unit_cents as number) >= 0),
  // CanonBench addition: hours and rates are not negative
  payroll_by_dept: ([emps]) => (emps as Rec[]).every((e) => (e.rate_cents as number) >= 0 && (e.hours as number) >= 0),
  // "coins holds positive coin values"
  min_coins: ([coins]) => (coins as number[]).every((c) => c > 0),
  // "kind is always "login" or "logout"", "events are in non-decreasing time order"
  session_totals: ([ev]) =>
    (ev as Rec[]).every((e, i, a) => (e.kind === "login" || e.kind === "logout") && (i === 0 || (a[i - 1].time as number) <= (e.time as number))),
  // "people is a non-empty list of distinct names, and every payer is one of them"
  settle_debts: ([ex, people]) =>
    (people as string[]).length > 0 && (ex as Rec[]).every((e) => (e.amount_cents as number) >= 0) && new Set(people as string[]).size === (people as string[]).length && (ex as Rec[]).every((e) => (people as string[]).includes(e.payer as string)),
  // "n is never negative"
  text_editor: ([ops]) => (ops as Rec[]).every((o) => !("n" in o) || (o.n as number) >= 0),
};

/** CanonBench addition: results stay inside Canon's 53-bit Int range (Canon traps with R003). */
export const OVERFLOW_TRAP = /R003/;

export const valid = (id: string, args: Args) => (PRECONDITIONS[id] ? PRECONDITIONS[id](args) : true);
