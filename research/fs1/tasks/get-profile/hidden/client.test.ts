import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "getProfile-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { getProfile } = await t.feature("getProfile");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, " Grace Hopper ", "correct horse"));
      const profile = t.ok(await getProfile(t.baseUrl, email));
      t.equal(profile, { email, name: "Grace Hopper" });
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}`);
      t.equal(profile, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "getProfile-errors",
    tags: [],
    async run(t) {
      const { getProfile } = await t.feature("getProfile");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await getProfile(t.baseUrl, email), "NoSuchUser").email, email);
    },
  },
];
