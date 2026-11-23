import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "changeEmail-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { changeEmail } = await t.feature("changeEmail");
      const email = `${t.unique("u")}@example.com`;
      const newEmail = `${t.unique("moved")}@example.org`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await changeEmail(t.baseUrl, email, newEmail)), { email: newEmail, name: "Ada" });
      const login = await t.http("POST", "/login", { email: newEmail, name: "", password: "correct horse" });
      t.equal(login.body, { email: newEmail, name: "Ada" }, "the server moved the account to the email the client sent");
      const old = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(old.status, 400, "the old email no longer logs in");
    },
  },
  {
    id: "changeEmail-errors",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { changeEmail } = await t.feature("changeEmail");
      const a = `${t.unique("a")}@example.com`;
      const b = `${t.unique("b")}@example.com`;
      t.ok(await signup(t.baseUrl, a, "Ada", "correct horse"));
      t.ok(await signup(t.baseUrl, b, "Bob", "correct horse"));
      t.equal(t.fails(await changeEmail(t.baseUrl, a, b), "Taken").email, b);
      const nobody = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await changeEmail(t.baseUrl, nobody, `${t.unique("x")}@example.com`), "NoSuchUser").email, nobody);
      t.fails(await changeEmail(t.baseUrl, a, "not an email"), "ValidationError");
    },
  },
];
