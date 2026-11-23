import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "changePassword-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { changePassword } = await t.feature("changePassword");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await changePassword(t.baseUrl, email, "correct horse", "battery staple")), { email, name: "Ada" });
      const fresh = await t.http("POST", "/login", { email, name: "", password: "battery staple" });
      t.equal(fresh.body, { email, name: "Ada" }, "the server saved the new password the client sent");
      const stale = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(stale.body, { error: { kind: "BadLogin" } }, "the old password no longer works");
    },
  },
  {
    id: "changePassword-errors",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { changePassword } = await t.feature("changePassword");
      const nobody = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await changePassword(t.baseUrl, nobody, "correct horse", "battery staple"), "NoSuchUser").email, nobody);
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Bo", "correct horse"));
      t.fails(await changePassword(t.baseUrl, email, "not my password", "battery staple"), "WrongPassword");
      t.fails(await changePassword(t.baseUrl, email, "correct horse", "short"), "ValidationError");
      t.fails(await changePassword(t.baseUrl, email, "correct horse", "correct horse"), "ValidationError");
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.body, { email, name: "Bo" }, "failed changes keep the password");
    },
  },
];
