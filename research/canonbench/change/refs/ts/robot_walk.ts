type Cmd = { kind: "Forward"; steps: number } | { kind: "Backward"; steps: number } | { kind: "TurnLeft" } | { kind: "TurnRight" };

export function robot_walk(cmds: Cmd[], obstacles: [number, number][]): [number, number, string] {
  const dirs = ["N", "E", "S", "W"];
  const dx = [0, 1, 0, -1];
  const dy = [1, 0, -1, 0];
  const blocked = new Set(obstacles.map(([x, y]) => x + "," + y));
  let x = 0;
  let y = 0;
  let d = 0;
  for (const c of cmds) {
    if (c.kind === "TurnLeft") d = (d + 3) % 4;
    else if (c.kind === "TurnRight") d = (d + 1) % 4;
    else {
      const m = c.kind === "Backward" ? (d + 2) % 4 : d;
      for (let k = 0; k < c.steps; k++) {
        const nx = x + dx[m];
        const ny = y + dy[m];
        if (blocked.has(nx + "," + ny)) break;
        x = nx;
        y = ny;
      }
    }
  }
  return [x, y, dirs[d]];
}
