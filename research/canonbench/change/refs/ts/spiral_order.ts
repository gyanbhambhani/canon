export function spiral_order(m: number[][], clockwise: boolean): number[] {
  // A clockwise spiral of m is the counterclockwise spiral of its transpose.
  if (clockwise) m = m.length === 0 ? [] : m[0].map((_, c) => m.map((row) => row[c]));
  const out: number[] = [];
  if (m.length === 0 || m[0].length === 0) return out;
  let top = 0;
  let bottom = m.length - 1;
  let left = 0;
  let right = m[0].length - 1;
  while (top <= bottom && left <= right) {
    for (let r = top; r <= bottom; r++) out.push(m[r][left]);
    for (let c = left + 1; c <= right; c++) out.push(m[bottom][c]);
    if (left < right) for (let r = bottom - 1; r >= top; r--) out.push(m[r][right]);
    if (top < bottom) for (let c = right - 1; c > left; c--) out.push(m[top][c]);
    top++;
    bottom--;
    left++;
    right--;
  }
  return out;
}
