type BankOp =
  | { kind: "Open"; name: string }
  | { kind: "Deposit"; name: string; amount: number }
  | { kind: "Withdraw"; name: string; amount: number }
  | { kind: "Transfer"; src: string; dst: string; amount: number };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function bank_ledger(ops: BankOp[]): Result<[string, number][]> {
  const bal = new Map<string, number>();
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const fail = (msg: string): Result<[string, number][]> => ({ ok: false, error: "step " + (i + 1) + ": " + msg });
    if (op.kind === "Open") {
      if (bal.has(op.name)) return fail("duplicate account " + op.name);
      bal.set(op.name, 0);
    } else if (op.kind === "Transfer") {
      if (!bal.has(op.src)) return fail("unknown account " + op.src);
      if (!bal.has(op.dst)) return fail("unknown account " + op.dst);
      if (op.src === op.dst) return fail("same account");
      if (op.amount <= 0) return fail("invalid amount");
      if (op.amount > bal.get(op.src)!) return fail("insufficient funds");
      bal.set(op.src, bal.get(op.src)! - op.amount);
      bal.set(op.dst, bal.get(op.dst)! + op.amount);
    } else {
      if (!bal.has(op.name)) return fail("unknown account " + op.name);
      if (op.amount <= 0) return fail("invalid amount");
      if (op.kind === "Withdraw") {
        if (op.amount > bal.get(op.name)!) return fail("insufficient funds");
        bal.set(op.name, bal.get(op.name)! - op.amount);
      } else bal.set(op.name, bal.get(op.name)! + op.amount);
    }
  }
  return { ok: true, value: [...bal.entries()] };
}
