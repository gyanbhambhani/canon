import type { ClientTest } from "../../../harness/client-api";

type Row = { email: string; orders: number; revenue: number };

export const tests: ClientTest[] = [
  {
    id: "revenueReport-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { revenueReport } = await t.feature("revenueReport");
      const sku = t.unique("sku");
      const ada = `${t.unique("ada")}@example.com`;
      const bob = `${t.unique("bob")}@example.com`;
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 50, tags: [] }));
      const a1 = t.ok<{ id: number }>(await placeOrder(t.baseUrl, ada, [{ sku, quantity: 2 }]));
      const a2 = t.ok<{ id: number }>(await placeOrder(t.baseUrl, ada, [{ sku, quantity: 1 }]));
      t.ok(await placeOrder(t.baseUrl, ada, [{ sku, quantity: 7 }]));
      t.ok(await placeOrder(t.baseUrl, bob, [{ sku, quantity: 1 }]));
      t.ok(await payOrder(t.baseUrl, a1.id));
      t.ok(await payOrder(t.baseUrl, a2.id));

      const rows = t.ok<Row[]>(await revenueReport(t.baseUrl));
      t.equal(rows, (await t.http("GET", "/reports/revenue")).body, "client parses what the server returns");
      t.equal(rows.filter((r) => r.email === ada), [{ email: ada, orders: 2, revenue: 900 }]);
      t.equal(rows.filter((r) => r.email === bob), [], "an email with no paid order has no row");
      for (let i = 1; i < rows.length; i++) {
        const [a, b] = [rows[i - 1], rows[i]];
        t.equal(a.revenue > b.revenue || (a.revenue === b.revenue && a.email < b.email), true, "sorted");
      }
    },
  },
];
