import type { ClientTest } from "../../../harness/client-api";

async function placed(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
  return t.ok<{ id: number }>(await placeOrder(t.baseUrl, "ada@example.com", [{ sku, quantity: 1 }]));
}

export const tests: ClientTest[] = [
  {
    id: "cancelOrder-probe",
    tags: ["probe"],
    async run(t) {
      const order = await placed(t);
      const { cancelOrder } = await t.feature("cancelOrder");
      const cancelled = t.ok(await cancelOrder(t.baseUrl, order.id));
      t.equal(cancelled, { ...order, status: { kind: "Cancelled" } });
    },
  },
  {
    id: "cancelOrder-errors",
    tags: [],
    async run(t) {
      const { cancelOrder } = await t.feature("cancelOrder");
      const { payOrder } = await t.feature("payOrder");
      t.equal(t.fails(await cancelOrder(t.baseUrl, 987654), "Missing").sku, "order 987654");
      const order = await placed(t);
      t.ok(await payOrder(t.baseUrl, order.id));
      t.equal(t.fails(await cancelOrder(t.baseUrl, order.id), "Invalid").reason, `order ${order.id} is paid`);
    },
  },
];
