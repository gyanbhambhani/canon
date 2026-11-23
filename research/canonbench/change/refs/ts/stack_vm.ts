type Instr =
  | { kind: "Push"; n: number }
  | { kind: "Pop" }
  | { kind: "Add" }
  | { kind: "Sub" }
  | { kind: "Mul" }
  | { kind: "Div" }
  | { kind: "Mod" }
  | { kind: "Dup" }
  | { kind: "Swap" }
  | { kind: "Jz"; target: number }
  | { kind: "Jmp"; target: number }
  | { kind: "Print" }
  | { kind: "Halt" };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function stack_vm(prog: Instr[]): Result<number[]> {
  const stack: number[] = [];
  const out: number[] = [];
  let pc = 0;
  let steps = 0;
  const need: Record<string, number> = { Push: 0, Pop: 1, Add: 2, Sub: 2, Mul: 2, Div: 2, Mod: 2, Dup: 1, Swap: 2, Jz: 1, Jmp: 0, Print: 1, Halt: 0 };
  while (pc < prog.length) {
    if (steps === 1000) return { ok: false, error: "step limit exceeded" };
    steps++;
    const ins = prog[pc];
    if (stack.length < need[ins.kind]) return { ok: false, error: "stack underflow at " + pc };
    if ((ins.kind === "Jz" || ins.kind === "Jmp") && (ins.target < 0 || ins.target >= prog.length)) {
      return { ok: false, error: "bad jump at " + pc };
    }
    let next = pc + 1;
    switch (ins.kind) {
      case "Push":
        stack.push(ins.n);
        break;
      case "Pop":
        stack.pop();
        break;
      case "Add":
      case "Sub":
      case "Mul": {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(ins.kind === "Add" ? a + b : ins.kind === "Sub" ? a - b : a * b);
        break;
      }
      case "Div":
      case "Mod": {
        const b = stack.pop()!;
        const a = stack.pop()!;
        if (b === 0) return { ok: false, error: "division by zero at " + pc };
        stack.push(ins.kind === "Div" ? Math.trunc(a / b) : a % b);
        break;
      }
      case "Dup":
        stack.push(stack[stack.length - 1]);
        break;
      case "Swap": {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(b, a);
        break;
      }
      case "Jz":
        if (stack.pop() === 0) next = ins.target;
        break;
      case "Jmp":
        next = ins.target;
        break;
      case "Print":
        out.push(stack.pop()!);
        break;
      case "Halt":
        next = prog.length;
        break;
    }
    pc = next;
  }
  return { ok: true, value: out };
}
