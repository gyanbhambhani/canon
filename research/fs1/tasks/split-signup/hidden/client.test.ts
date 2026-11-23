import type { ClientTest } from "../../../harness/client-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const tests: ClientTest[] = [
  {
    id: "split-signup-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      const pending = t.ok<{ email: string; token: string }>(await signup(t.baseUrl, email, " Ada ", "correct horse"));
      t.equal(Object.keys(pending).sort(), ["email", "token"], "the pending account's fields");
      t.equal(pending.email, email);
      t.equal(UUID.test(pending.token), true, `a uuid token, got ${JSON.stringify(pending.token)}`);
      // the token the client parsed is the one the server knows
      const confirmed = await t.http("POST", "/users/confirm", { token: pending.token });
      t.equal(confirmed.body, { email, name: "Ada" }, "the server confirmed the client's token");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse"), "Taken").email, email);
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse"), "ValidationError");
    },
  },
  {
    id: "confirmSignup-probe",
    tags: ["probe"],
    async run(t) {
      const { confirmSignup } = await t.feature("confirmSignup");
      const email = `${t.unique("u")}@example.com`;
      const r = await t.http("POST", "/users", { email, name: "Grace", password: "correct horse" });
      const token = (r.body as { token: string }).token;
      const login = { email, name: "", password: "correct horse" };
      t.equal((await t.http("POST", "/login", login)).body, { error: { kind: "NotConfirmed" } }, "pending before confirming");
      t.equal(t.ok(await confirmSignup(t.baseUrl, token)), { email, name: "Grace" });
      t.equal((await t.http("POST", "/login", login)).body, { email, name: "Grace" }, "the server confirmed what the client sent");
      t.fails(await confirmSignup(t.baseUrl, token), "BadToken");
      t.fails(await confirmSignup(t.baseUrl, t.unique("token")), "BadToken");
    },
  },
];
