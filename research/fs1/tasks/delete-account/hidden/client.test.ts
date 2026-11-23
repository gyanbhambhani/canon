import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "deleteAccount-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { deleteAccount } = await t.feature("deleteAccount");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await deleteAccount(t.baseUrl, email, "correct horse")), { email, name: "Ada" });
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.status, 400, "the server deleted the account the client named");
      t.equal(login.body, { error: { kind: "BadLogin" } });
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"), "signing up again");
    },
  },
  {
    id: "deleteAccount-errors",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { deleteAccount } = await t.feature("deleteAccount");
      const nobody = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await deleteAccount(t.baseUrl, nobody, "correct horse"), "NoSuchUser").email, nobody);
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Bo", "correct horse"));
      t.fails(await deleteAccount(t.baseUrl, email, "wrong password"), "BadLogin");
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.body, { email, name: "Bo" }, "a wrong password keeps the account");
    },
  },
];
