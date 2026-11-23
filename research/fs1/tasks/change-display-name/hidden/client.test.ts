import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "changeDisplayName-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { changeDisplayName } = await t.feature("changeDisplayName");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await changeDisplayName(t.baseUrl, email, " Grace ")), { email, name: "Grace" });
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.body, { email, name: "Grace" }, "the server saved what the client sent");
    },
  },
  {
    id: "changeDisplayName-errors",
    tags: [],
    async run(t) {
      const { changeDisplayName } = await t.feature("changeDisplayName");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await changeDisplayName(t.baseUrl, email, "Bob"), "NoSuchUser").email, email);
      t.fails(await changeDisplayName(t.baseUrl, email, "   "), "ValidationError");
      t.fails(await changeDisplayName(t.baseUrl, email, "z".repeat(41)), "ValidationError");
    },
  },
];
