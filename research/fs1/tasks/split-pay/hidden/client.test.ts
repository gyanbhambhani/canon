import type { ClientTest } from "../../../harness/client-api";

async function placed(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
  const order = t.ok<{ id: number; total: number; status: unknown }>(
    await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 2 }]),
  );
  t.equal(order.total, 900);
  t.equal(order.status, { kind: "Open" });
  return order;
}

export const tests: ClientTest[] = [
  {
    id: "authorizeOrder-probe",
    tags: ["probe"],
    async run(t) {
      const { authorizeOrder } = await t.feature("authorizeOrder");
      const order = await placed(t);
      const authorized = t.ok(await authorizeOrder(t.baseUrl, order.id));
      t.equal(authorized, { ...order, status: { kind: "Authorized", authorization: "test-receipt-900" } });
      const again = await t.http("POST", `/orders/${order.id}/authorize`);
      t.equal(again.status, 400, "the server kept the authorization");
    },
  },
  {
    id: "captureOrder-probe",
    tags: ["probe"],
    async run(t) {
      const { authorizeOrder } = await t.feature("authorizeOrder");
      const { captureOrder } = await t.feature("captureOrder");
      const order = await placed(t);
      t.ok(await authorizeOrder(t.baseUrl, order.id));
      const paid = t.ok(await captureOrder(t.baseUrl, order.id));
      t.equal(paid, { ...order, status: { kind: "Paid", receipt: "test-receipt-900" } });
      const again = await t.http("POST", `/orders/${order.id}/capture`);
      t.equal(again.body?.error?.kind, "Invalid", "the server kept the capture");
    },
  },
  {
    id: "split-pay-errors",
    tags: [],
    async run(t) {
      const { authorizeOrder } = await t.feature("authorizeOrder");
      const { captureOrder } = await t.feature("captureOrder");
      const { placeOrder } = await t.feature("placeOrder");
      t.equal(t.fails(await authorizeOrder(t.baseUrl, 987654), "Missing").sku, "order 987654");
      t.equal(t.fails(await captureOrder(t.baseUrl, 987654), "Missing").sku, "order 987654");
      const order = await placed(t);
      t.equal(t.fails(await captureOrder(t.baseUrl, order.id), "Invalid").reason, `order ${order.id} is not authorized`);
      t.ok(await authorizeOrder(t.baseUrl, order.id));
      t.equal(t.fails(await authorizeOrder(t.baseUrl, order.id), "Invalid").reason, `order ${order.id} is not open`);
      const missing = t.unique("none");
      t.equal(t.fails(await placeOrder(t.baseUrl, "ada@example.com", [{ sku: missing, quantity: 1 }]), "Missing").sku, missing);
    },
  },
];
