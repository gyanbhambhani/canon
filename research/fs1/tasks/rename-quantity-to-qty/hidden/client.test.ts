import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "order-and-pay-qty-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const order = t.ok<{ id: number; lines: unknown; total: number; status: unknown }>(
        await placeOrder(t.baseUrl, email, [{ sku, qty: 2 }]),
      );
      t.equal(order.lines, [{ sku, qty: 2 }], "the server read the qty the client sent");
      t.equal(order.total, 900);
      t.equal(order.status, { kind: "Open" });
      const paid = t.ok<{ lines: unknown; status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.lines, [{ sku, qty: 2 }]);
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      const summaries = (await t.http("GET", "/summaries")).body as { email: string; spent: number }[];
      t.equal(summaries.find((s) => s.email === email)?.spent, 900, "the server totals the client's qty");
      t.equal(t.fails(await placeOrder(t.baseUrl, email, [{ sku: t.unique("none"), qty: 1 }]), "Missing").sku !== undefined, true);
    },
  },
];
