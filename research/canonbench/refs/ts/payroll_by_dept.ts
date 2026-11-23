type Employee = { name: string; dept: string; hours: number; rate_cents: number };

export function payroll_by_dept(emps: Employee[]): [string, number][] {
  const totals = new Map<string, number>();
  for (const e of emps) {
    const pay = e.hours <= 40 ? e.hours * e.rate_cents : 40 * e.rate_cents + Math.floor(((e.hours - 40) * e.rate_cents * 3) / 2);
    totals.set(e.dept, (totals.get(e.dept) ?? 0) + pay);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}
