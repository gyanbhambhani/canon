import type { ClientTest } from "../../../harness/client-api";

type Profile = { email: string; name: string };

export const tests: ClientTest[] = [
  {
    id: "listUsers-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { listUsers } = await t.feature("listUsers");
      for (const name of ["Ada", "Bo"]) t.ok(await signup(t.baseUrl, `${t.unique("u")}@example.com`, name, "correct horse"));
      const page = t.ok<Profile[]>(await listUsers(t.baseUrl, 1, 2));
      const server = await t.http("GET", "/users?page=1&per_page=2");
      t.equal(page, server.body, "the client parsed what the server returned");
      t.equal(page.length, 2, "page size");
    },
  },
  {
    id: "listUsers-all-pages",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { listUsers } = await t.feature("listUsers");
      const mine = [`${t.unique("b")}@example.com`, `${t.unique("a")}@example.com`, `${t.unique("c")}@example.com`];
      for (const email of mine) t.ok(await signup(t.baseUrl, email, "Pager", "correct horse"));
      const all: Profile[] = [];
      for (let p = 1; p < 1000; p++) {
        const page = t.ok<Profile[]>(await listUsers(t.baseUrl, p, 7));
        if (page.length === 0) break;
        if (page.length > 7) throw new Error(`page ${p} has ${page.length} users`);
        all.push(...page);
      }
      const emails = all.map((u) => u.email);
      const sorted = [...emails].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      t.equal(emails, sorted, "sorted by email");
      for (const email of mine) t.equal(all.find((u) => u.email === email), { email, name: "Pager" }, email);
    },
  },
  {
    id: "listUsers-validation",
    tags: [],
    async run(t) {
      const { listUsers } = await t.feature("listUsers");
      t.fails(await listUsers(t.baseUrl, 0, 5), "ValidationError");
      t.fails(await listUsers(t.baseUrl, 1, 26), "ValidationError");
      t.fails(await listUsers(t.baseUrl, 1, 0), "ValidationError");
    },
  },
];
