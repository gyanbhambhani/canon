import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-first-last-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      const profile = t.ok(await signup(t.baseUrl, email, " Grace ", " Hopper ", "correct horse"));
      t.equal(profile, { email, first_name: "Grace", last_name: "Hopper" });
      const login = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(login.body, profile, "the server saved the names the client sent");
      t.equal(t.fails(await signup(t.baseUrl, email, "Grace", "Hopper", "correct horse"), "Taken").email, email);
    },
  },
  {
    id: "signup-first-last-rules",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const single = `${t.unique("u")}@example.com`;
      t.equal(t.ok(await signup(t.baseUrl, single, "Plato", "", "correct horse")), { email: single, first_name: "Plato", last_name: "" });
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "  ", "Hopper", "correct horse"), "ValidationError");
      t.fails(await signup(t.baseUrl, "nope", "Grace", "Hopper", "correct horse"), "ValidationError");
      t.fails(await signup(t.baseUrl, `${t.unique("u")}@example.com`, "Grace", "Hopper", "short"), "ValidationError");
    },
  },
];
