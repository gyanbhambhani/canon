import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "order-and-pay-money-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const order = t.ok<{ id: number; total: unknown; status: unknown }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }]));
      t.equal(order.total, { cents: 900, currency: "USD" });
      t.equal(order.status, { kind: "Open" });
      const paid = t.ok<{ id: number; total: unknown; status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.total, { cents: 900, currency: "USD" });
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      const summaries = (await t.http("GET", "/summaries")).body as { email: string; spent: number }[];
      t.equal(summaries.find((s) => s.email === email)?.spent, 900, "server's own total in cents");
      t.equal(t.fails(await placeOrder(t.baseUrl, email, [{ sku: t.unique("none"), quantity: 1 }]), "Missing").sku !== undefined, true);
    },
  },
];
