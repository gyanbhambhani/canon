import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "addDiscount-probe",
    tags: ["probe"],
    async run(t) {
      const { addDiscount } = await t.feature("addDiscount");
      const code = t.unique("CODE");
      t.equal(t.ok(await addDiscount(t.baseUrl, code, 15)), { code, percent: 15 });
      const again = await t.http("POST", "/discounts", { code, percent: 15 });
      t.equal([again.status, again.body?.error?.kind], [400, "Invalid"], "the server saved the code the client sent");
      t.equal(t.fails(await addDiscount(t.baseUrl, code, 20), "Invalid").reason, `duplicate code ${code}`);
      t.fails(await addDiscount(t.baseUrl, t.unique("C"), 0), "ValidationError");
      t.fails(await addDiscount(t.baseUrl, "AB", 10), "ValidationError");
    },
  },
  {
    id: "applyDiscount-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { addDiscount } = await t.feature("addDiscount");
      const { applyDiscount } = await t.feature("applyDiscount");
      const sku = t.unique("sku");
      const code = t.unique("CODE");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 2209, stock: 5, tags: [] }));
      t.ok(await addDiscount(t.baseUrl, code, 10));
      const order = t.ok<{ id: number; total: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
      const discounted = t.ok(await applyDiscount(t.baseUrl, order.id, code));
      t.equal(discounted, { ...order, total: 1989 });
      const detail = await t.http("POST", `/orders/${order.id}/pay`);
      t.equal(detail.body.total, 1989, "the server applied the code the client sent");
      t.equal(detail.body.status, { kind: "Paid", receipt: "test-receipt-1989" });
      t.equal(t.fails(await applyDiscount(t.baseUrl, order.id, code), "Invalid").reason, `order ${order.id} is not open`);
      const other = t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
      const unknown = t.unique("NOPE");
      t.equal(t.fails(await applyDiscount(t.baseUrl, other.id, unknown), "UnknownCode").code, unknown);
      t.equal(t.fails(await applyDiscount(t.baseUrl, 987654, code), "Missing").sku, "order 987654");
      t.ok(await payOrder(t.baseUrl, other.id));
    },
  },
];
