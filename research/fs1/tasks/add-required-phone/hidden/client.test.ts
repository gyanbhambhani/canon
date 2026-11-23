import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "signup-phone-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      const profile = t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse", " +15550100200 "));
      t.equal(profile, { email, name: "Ada", phone: "+15550100200" });
      const login = await t.http("POST", "/login", { email, password: "correct horse" });
      t.equal(login.body, profile, "the server saved the phone the client sent");
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse", "5550100200"), "Taken").email, email);
    },
  },
  {
    id: "signup-phone-errors",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse", "555-0100"), "BadPhone").phone, "555-0100");
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse", "5550100200"), "ValidationError");
    },
  },
];
