import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "setDefaultAddress-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { setDefaultAddress } = await t.feature("setDefaultAddress");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      const set = t.ok(await setDefaultAddress(t.baseUrl, email, " 12 Analytical Row ", "London ", "NW1 6XE"));
      t.equal(set, { street: "12 Analytical Row", city: "London", postcode: "NW1 6XE" });
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}/default-address`);
      t.equal(server.body, set, "the server saved what the client sent");
    },
  },
  {
    id: "getDefaultAddress-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { setDefaultAddress } = await t.feature("setDefaultAddress");
      const { getDefaultAddress } = await t.feature("getDefaultAddress");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await getDefaultAddress(t.baseUrl, email)), null, "no address yet");
      t.ok(await setDefaultAddress(t.baseUrl, email, "1 Main St", "Leeds", "LS1 1AA"));
      t.ok(await setDefaultAddress(t.baseUrl, email, "2 Side St", "York", "YO1"));
      const got = t.ok(await getDefaultAddress(t.baseUrl, email));
      t.equal(got, { street: "2 Side St", city: "York", postcode: "YO1" });
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}/default-address`);
      t.equal(got, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "defaultAddress-errors",
    tags: [],
    async run(t) {
      const { setDefaultAddress } = await t.feature("setDefaultAddress");
      const { getDefaultAddress } = await t.feature("getDefaultAddress");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await setDefaultAddress(t.baseUrl, email, "1 Main St", "Leeds", "LS1"), "NoSuchUser").email, email);
      t.equal(t.fails(await getDefaultAddress(t.baseUrl, email), "NoSuchUser").email, email);
      t.fails(await setDefaultAddress(t.baseUrl, email, "1 Main St", " ", "LS1"), "ValidationError");
      t.fails(await setDefaultAddress(t.baseUrl, email, "1 Main St", "Leeds", "L1"), "ValidationError");
    },
  },
];
