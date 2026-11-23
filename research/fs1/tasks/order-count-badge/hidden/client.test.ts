import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "orderBadge-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { signup } = await t.feature("signup");
      const { orderBadge } = await t.feature("orderBadge");
      const sku = t.unique("sku");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await orderBadge(t.baseUrl, email)), { email, open: 0, label: "No open orders" });
      for (let i = 0; i < 2; i++) t.ok(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      const got = t.ok(await orderBadge(t.baseUrl, email));
      t.equal(got, { email, open: 2, label: "2 open orders" });
      t.equal(got, (await t.http("GET", `/users/${encodeURIComponent(email)}/badge`)).body, "client parses what the server returns");
    },
  },
  {
    id: "orderBadge-no-user",
    tags: [],
    async run(t) {
      const { orderBadge } = await t.feature("orderBadge");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await orderBadge(t.baseUrl, email), "NoUser").email, email);
    },
  },
];
