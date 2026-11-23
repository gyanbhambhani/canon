import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-terms-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      const profile = t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse", true));
      t.equal(profile, { email, name: "Ada" });
      const login = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(login.body, profile, "the server created the account the client asked for");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse", true), "Taken").email, email);
    },
  },
  {
    id: "signup-terms-rule",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.fails(await signup(t.baseUrl, email, "Ada", "correct horse", false), "ValidationError");
      const login = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(login.status, 400, "no account without accepting the terms");
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse", true), "ValidationError");
    },
  },
];
