type Student = { name: string; scores: number[] };

export function student_medians(students: Student[]): [string, number][] {
  const rows: [string, number][] = [];
  for (const s of students) {
    if (s.scores.length === 0) continue;
    const xs = [...s.scores].sort((a, b) => a - b);
    const n = xs.length;
    rows.push([s.name, n % 2 === 1 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2]);
  }
  rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return rows;
}
