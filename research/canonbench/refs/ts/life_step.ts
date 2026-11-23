export function life_step(grid: string[], steps: number): string[] {
  let g = grid.map((row) => row.split(""));
  for (let s = 0; s < steps; s++) {
    g = g.map((row, r) =>
      row.map((cell, c) => {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (g[r + dr]?.[c + dc] === "#") n++;
          }
        return (cell === "#" && (n === 2 || n === 3)) || (cell !== "#" && n === 3) ? "#" : ".";
      }),
    );
  }
  return g.map((row) => row.join(""));
}
