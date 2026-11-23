type Contact = { name: string; email: string; phone: string };

export function merge_contacts(contacts: Contact[]): Contact[] {
  const n = contacts.length;
  const parent = contacts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const digits = (s: string) => s.replace(/[^0-9]/g, "");
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = contacts[i];
      const b = contacts[j];
      const ea = a.email.trim();
      const pa = digits(a.phone);
      if ((ea !== "" && ea === b.email.trim()) || (pa !== "" && pa === digits(b.phone))) {
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
      }
    }
  }
  const groups = new Map<number, Contact>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const c = contacts[i];
    const g = groups.get(r);
    if (!g) groups.set(r, { name: c.name, email: c.email, phone: c.phone });
    else {
      if (g.name === "") g.name = c.name;
      if (g.email === "") g.email = c.email;
      if (g.phone === "") g.phone = c.phone;
    }
  }
  return [...groups.values()];
}
