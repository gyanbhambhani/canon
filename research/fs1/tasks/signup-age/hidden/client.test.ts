import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-age-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.equal(t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse", 36)), { email, name: "Ada", age: 36 });
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.body, { email, name: "Ada", age: 36 }, "the server saved the age the client sent");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse", 36), "Taken").email, email);
    },
  },
  {
    id: "signup-age-rule",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      t.fails(await signup(t.baseUrl, `${t.unique("kid")}@example.com`, "Kid", "correct horse", 12), "ValidationError");
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse", 30), "ValidationError");
    },
  },
];
