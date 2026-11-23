import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "login-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { login } = await t.feature("login");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, " Grace ", "correct horse"));
      const profile = t.ok(await login(t.baseUrl, email, "correct horse"));
      t.equal(profile, { email, name: "Grace" });
      const server = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(profile, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "login-bad-login",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { login } = await t.feature("login");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Grace", "correct horse"));
      t.fails(await login(t.baseUrl, email, "wrong horse"), "BadLogin", "wrong password");
      t.fails(await login(t.baseUrl, `${t.unique("nobody")}@example.com`, "correct horse"), "BadLogin", "unknown email");
      t.fails(await login(t.baseUrl, email, ""), "BadLogin", "empty password");
    },
  },
];
