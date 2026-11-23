import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "getOrderStats-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { getOrderStats } = await t.feature("getOrderStats");
      const email = `${t.unique("u")}@example.com`;
      const sku = t.unique("sku");
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.equal(t.ok(await getOrderStats(t.baseUrl, email)), { email, orders: 0, spent: 0 }, "no orders yet");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const paid = t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }]));
      t.ok(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      t.ok(await payOrder(t.baseUrl, paid.id));
      const stats = t.ok(await getOrderStats(t.baseUrl, email));
      t.equal(stats, { email, orders: 2, spent: 900 });
      const server = await t.http("GET", `/users/${encodeURIComponent(email)}/stats`);
      t.equal(stats, server.body, "the client parsed what the server returned");
    },
  },
  {
    id: "getOrderStats-errors",
    tags: [],
    async run(t) {
      const { getOrderStats } = await t.feature("getOrderStats");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await getOrderStats(t.baseUrl, email), "NoSuchUser").email, email);
    },
  },
];
