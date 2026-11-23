import type { ClientTest } from "../../../harness/client-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const tests: ClientTest[] = [
  {
    id: "requestPasswordReset-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { requestPasswordReset } = await t.feature("requestPasswordReset");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      const issued = t.ok<{ token: string }>(await requestPasswordReset(t.baseUrl, email));
      t.equal(Object.keys(issued), ["token"], "the response's fields");
      t.equal(UUID.test(issued.token), true, `a uuid token, got ${JSON.stringify(issued.token)}`);
      // the server knows the token the client parsed
      const r = await t.http("POST", "/password-resets", { token: issued.token, new_password: "battery staple" });
      t.equal(r.body, { email, name: "Ada" }, "the server redeemed the client's token");
      t.equal(t.fails(await requestPasswordReset(t.baseUrl, `${t.unique("nobody")}@example.com`), "NoSuchUser").email !== undefined, true);
    },
  },
  {
    id: "resetPassword-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { resetPassword } = await t.feature("resetPassword");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Grace", "correct horse"));
      const { token } = (await t.http("POST", `/users/${encodeURIComponent(email)}/reset`)).body as { token: string };
      t.equal(t.ok(await resetPassword(t.baseUrl, token, "battery staple")), { email, name: "Grace" });
      const login = await t.http("POST", "/login", { email, name: "", password: "battery staple" });
      t.equal(login.status, 200, "the server saved the new password the client sent");
      t.fails(await resetPassword(t.baseUrl, token, "another secret"), "BadToken");
    },
  },
  {
    id: "resetPassword-rule",
    tags: [],
    async run(t) {
      const { resetPassword } = await t.feature("resetPassword");
      t.fails(await resetPassword(t.baseUrl, t.unique("token"), "short"), "ValidationError");
      t.fails(await resetPassword(t.baseUrl, t.unique("token"), "long enough"), "BadToken");
    },
  },
];
