export function lis_length(xs: number[]): [number, number] {
  const n = xs.length;
  if (n === 0) return [0, 0];
  const len: number[] = [];
  const cnt: number[] = [];
  for (let i = 0; i < n; i++) {
    len.push(1);
    cnt.push(1);
    for (let j = 0; j < i; j++) {
      if (xs[j] < xs[i]) {
        if (len[j] + 1 > len[i]) {
          len[i] = len[j] + 1;
          cnt[i] = cnt[j];
        } else if (len[j] + 1 === len[i]) {
          cnt[i] += cnt[j];
        }
      }
    }
  }
  const best = Math.max(...len);
  let total = 0;
  for (let i = 0; i < n; i++) if (len[i] === best) total += cnt[i];
  return [best, total];
}
