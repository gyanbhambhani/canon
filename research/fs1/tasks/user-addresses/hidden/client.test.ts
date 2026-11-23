import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "addAddress-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { addAddress } = await t.feature("addAddress");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      const added = t.ok<{ id: number }>(await addAddress(t.baseUrl, email, " 12 Analytical Row ", "London ", "NW1 6XE"));
      t.equal(typeof added.id, "number", "id");
      t.equal(added, { id: added.id, email, street: "12 Analytical Row", city: "London", postcode: "NW1 6XE" });
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}/addresses`);
      t.equal(server.body, [added], "the server saved what the client sent");
    },
  },
  {
    id: "listAddresses-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { addAddress } = await t.feature("addAddress");
      const { listAddresses } = await t.feature("listAddresses");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await listAddresses(t.baseUrl, email)), [], "no addresses yet");
      const a = t.ok<{ id: number }>(await addAddress(t.baseUrl, email, "1 Main St", "Leeds", "LS1 1AA"));
      const b = t.ok<{ id: number }>(await addAddress(t.baseUrl, email, "2 Side St", "York", "YO1"));
      const list = t.ok(await listAddresses(t.baseUrl, email));
      t.equal(list, [a, b]);
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}/addresses`);
      t.equal(list, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "addresses-errors",
    tags: [],
    async run(t) {
      const { addAddress } = await t.feature("addAddress");
      const { listAddresses } = await t.feature("listAddresses");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await addAddress(t.baseUrl, email, "1 Main St", "Leeds", "LS1"), "NoSuchUser").email, email);
      t.equal(t.fails(await listAddresses(t.baseUrl, email), "NoSuchUser").email, email);
      t.fails(await addAddress(t.baseUrl, email, "  ", "Leeds", "LS1"), "ValidationError");
      t.fails(await addAddress(t.baseUrl, email, "1 Main St", "Leeds", "L1"), "ValidationError");
    },
  },
];
