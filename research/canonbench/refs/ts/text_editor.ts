type EditOp =
  | { kind: "Insert"; text: string }
  | { kind: "Delete"; n: number }
  | { kind: "Left"; n: number }
  | { kind: "Right"; n: number }
  | { kind: "Undo" };

export function text_editor(ops: EditOp[]): string {
  let text = "";
  let cur = 0;
  const history: [string, number][] = [];
  for (const op of ops) {
    switch (op.kind) {
      case "Insert":
        history.push([text, cur]);
        text = text.slice(0, cur) + op.text + text.slice(cur);
        cur += op.text.length;
        break;
      case "Delete": {
        history.push([text, cur]);
        const k = Math.min(op.n, cur);
        text = text.slice(0, cur - k) + text.slice(cur);
        cur -= k;
        break;
      }
      case "Left":
        cur = Math.max(0, cur - op.n);
        break;
      case "Right":
        cur = Math.min(text.length, cur + op.n);
        break;
      case "Undo": {
        const prev = history.pop();
        if (prev) [text, cur] = prev;
        break;
      }
    }
  }
  return text;
}
