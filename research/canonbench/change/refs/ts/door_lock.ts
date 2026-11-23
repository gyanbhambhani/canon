type Key = { kind: "Digit"; d: number } | { kind: "Enter" } | { kind: "Clear" } | { kind: "Reset" };

export function door_lock(code: string, events: Key[]): string {
  let state = "locked";
  let buf = "";
  let fails = 0;
  for (const k of events) {
    if (state === "blocked") {
      if (k.kind === "Reset") {
        state = "locked";
        buf = "";
        fails = 0;
      }
      continue;
    }
    if (state === "open") {
      if (k.kind === "Enter") {
        state = "locked";
        buf = "";
      }
      continue;
    }
    if (k.kind === "Digit") {
      buf += String(k.d);
      if (buf.length > code.length) buf = buf.slice(buf.length - code.length);
    } else if (k.kind === "Clear") buf = "";
    else if (k.kind === "Enter") {
      if (buf === code) {
        state = "open";
        fails = 0;
      } else {
        fails++;
        if (fails >= 3) state = "blocked";
      }
      buf = "";
    }
  }
  return state;
}
