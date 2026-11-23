import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-strong-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.equal(t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse 9")), { email, name: "Ada" });
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse 9" });
      t.equal(login.body, { email, name: "Ada" }, "the server saved the password the client sent");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse 9"), "Taken").email, email);
    },
  },
  {
    id: "signup-password-rule",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "Ada", "password123"), "ValidationError");
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "Ada", "correct horse"), "WeakPassword");
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse 9"), "ValidationError");
    },
  },
];
