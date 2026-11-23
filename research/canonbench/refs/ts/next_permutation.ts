export function next_permutation(xs: number[]): number[] {
  const a = [...xs];
  let i = a.length - 2;
  while (i >= 0 && a[i] >= a[i + 1]) i--;
  if (i < 0) return a.sort((x, y) => x - y);
  let j = a.length - 1;
  while (a[j] <= a[i]) j--;
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
  const tail = a.slice(i + 1).reverse();
  return a.slice(0, i + 1).concat(tail);
}
