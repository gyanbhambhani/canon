import type { ClientTest } from "../../../harness/client-api";

async function placed(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
  return t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 3 }]));
}

export const tests: ClientTest[] = [
  {
    id: "refundOrder-probe",
    tags: ["probe"],
    async run(t) {
      const { payOrder } = await t.feature("payOrder");
      const { refundOrder } = await t.feature("refundOrder");
      const order = await placed(t);
      t.ok(await payOrder(t.baseUrl, order.id));
      const refunded = t.ok(await refundOrder(t.baseUrl, order.id));
      t.equal(refunded, { ...order, status: { kind: "Refunded", refund: "test-receipt-900" } });
      const again = await t.http("POST", `/orders/${order.id}/refund`);
      t.equal(again.status, 400, "the server kept the refund");
    },
  },
  {
    id: "refundOrder-errors",
    tags: [],
    async run(t) {
      const { refundOrder } = await t.feature("refundOrder");
      t.equal(t.fails(await refundOrder(t.baseUrl, 987654), "Missing").sku, "order 987654");
      const order = await placed(t);
      t.equal(t.fails(await refundOrder(t.baseUrl, order.id), "Invalid").reason, `order ${order.id} is not paid`);
    },
  },
];
