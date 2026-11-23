import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-full-name-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.equal(t.ok(await signup(t.baseUrl, email, " Ada Lovelace ", "correct horse")), { email, full_name: "Ada Lovelace" });
      const login = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(login.body, { email, full_name: "Ada Lovelace" }, "the server saved the full name the client sent");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse"), "Taken").email, email);
    },
  },
  {
    id: "signup-full-name-rules",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "   ", "correct horse"), "ValidationError");
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse"), "ValidationError");
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "Ada", "short"), "ValidationError");
    },
  },
];
