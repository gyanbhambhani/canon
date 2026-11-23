import type { ClientTest } from "../../../harness/client-api";

async function placed(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
  return t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
}

export const tests: ClientTest[] = [
  {
    id: "shipOrder-probe",
    tags: ["probe"],
    async run(t) {
      const { payOrder } = await t.feature("payOrder");
      const { shipOrder } = await t.feature("shipOrder");
      const order = await placed(t);
      const paid = t.ok(await payOrder(t.baseUrl, order.id));
      const tracking = t.unique("TRK");
      const shipped = t.ok(await shipOrder(t.baseUrl, order.id, ` ${tracking} `));
      t.equal(shipped, { ...paid, status: { kind: "Shipped", tracking } });
      const again = await t.http("POST", `/orders/${order.id}/ship`, { tracking });
      t.equal(again.status, 400, "the server kept the shipment");
    },
  },
  {
    id: "shipOrder-errors",
    tags: [],
    async run(t) {
      const { shipOrder } = await t.feature("shipOrder");
      t.equal(t.fails(await shipOrder(t.baseUrl, 987654, "TRK1"), "Missing").sku, "order 987654");
      const order = await placed(t);
      t.equal(t.fails(await shipOrder(t.baseUrl, order.id, "TRK1"), "Invalid").reason, `order ${order.id} is not paid`);
      t.fails(await shipOrder(t.baseUrl, order.id, "   "), "ValidationError");
    },
  },
];
