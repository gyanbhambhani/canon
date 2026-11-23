export function max_subarray(xs: number[]): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  for (let i = 0; i < xs.length; i++) {
    let s = 0;
    for (let j = i; j < xs.length; j++) {
      s += xs[j];
      if (best === null || s > best[0]) best = [s, i, j];
    }
  }
  return best;
}
