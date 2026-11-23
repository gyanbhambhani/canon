import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "order-and-pay-string-id-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const order = t.ok<{ id: unknown; total: number }>(await placeOrder(t.baseUrl, "ada@example.com", [{ sku, quantity: 2 }]));
      t.equal(typeof order.id, "string", "order id type");
      t.equal(/^order-\d+$/.test(String(order.id)), true, "order id form");
      const paid = t.ok<{ id: unknown; status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.id, order.id);
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      t.equal(t.fails(await payOrder(t.baseUrl, "order-99999"), "Missing").sku, "order-99999");
    },
  },
];
