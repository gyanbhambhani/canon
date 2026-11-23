import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "getOrder-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { getOrder } = await t.feature("getOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
      const order = t.ok<{ id: number }>(await placeOrder(t.baseUrl, "ada@example.com", [{ sku, quantity: 2 }]));
      const got = t.ok(await getOrder(t.baseUrl, order.id));
      t.equal(got, order);
      t.equal(got, (await t.http("GET", `/orders/${order.id}`)).body, "client parses what the server returns");
      const paid = t.ok(await payOrder(t.baseUrl, order.id));
      t.equal(t.ok(await getOrder(t.baseUrl, order.id)), paid);
    },
  },
  {
    id: "getOrder-missing",
    tags: [],
    async run(t) {
      const { getOrder } = await t.feature("getOrder");
      t.equal(t.fails(await getOrder(t.baseUrl, 987654), "Missing").sku, "order 987654");
    },
  },
];
