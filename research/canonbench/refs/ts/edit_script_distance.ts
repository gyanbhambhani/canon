export function edit_script_distance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= n; i++) {
    d.push([]);
    for (let j = 0; j <= m; j++) {
      if (i === 0) d[i].push(j);
      else if (j === 0) d[i].push(i);
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i].push(v);
      }
    }
  }
  return d[n][m];
}
