import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "reorder-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { reorder } = await t.feature("reorder");
      const sku = t.unique("sku");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
      const order = t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }]));
      t.ok(await payOrder(t.baseUrl, order.id));
      const again = t.ok<{ id: number }>(await reorder(t.baseUrl, order.id));
      t.equal(again.id > order.id, true, "a new id");
      t.equal(again, { id: again.id, email, lines: [{ sku, quantity: 2 }], total: 600, status: { kind: "Open" } });
      const server = await t.http("POST", `/orders/${again.id}/pay`);
      t.equal(server.body, { ...again, status: { kind: "Paid", receipt: "test-receipt-600" } }, "the server saved the new order");
    },
  },
  {
    id: "reorder-errors",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { reorder } = await t.feature("reorder");
      t.equal(t.fails(await reorder(t.baseUrl, 987654), "Missing").sku, "order 987654");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
      const order = t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
      await t.http("DELETE", `/products/${sku}`);
      t.equal(t.fails(await reorder(t.baseUrl, order.id), "Missing").sku, sku);
    },
  },
];
