import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "order-and-pay-string-status-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const order = t.ok<{ id: number; total: number; status: unknown; receipt: unknown }>(
        await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }]),
      );
      t.equal(order.total, 900);
      t.equal(order.status, "open");
      t.equal(order.receipt, null);
      const paid = t.ok<{ status: unknown; receipt: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.status, "paid");
      t.equal(paid.receipt, "test-receipt-900");
      t.equal(t.fails(await placeOrder(t.baseUrl, email, [{ sku: t.unique("none"), quantity: 1 }]), "Missing").sku !== undefined, true);
    },
  },
  {
    id: "countOrders-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { countOrders } = await t.feature("countOrders");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const first = t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      t.ok(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      t.ok(await payOrder(t.baseUrl, first.id));
      t.equal(t.ok(await countOrders(t.baseUrl, email, "open")), 1);
      t.equal(t.ok(await countOrders(t.baseUrl, email, "paid")), 1);
      t.equal(t.ok(await countOrders(t.baseUrl, email, "cancelled")), 0);
      const server = await t.http("GET", `/orders/count?email=${encodeURIComponent(email)}&status=paid`);
      t.equal(server.body, 1, "server ground truth");
      t.fails(await countOrders(t.baseUrl, email, "Paid"), "ValidationError");
    },
  },
];
