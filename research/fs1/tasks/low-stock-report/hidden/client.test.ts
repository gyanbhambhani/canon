import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "lowStockReport-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { lowStockReport } = await t.feature("lowStockReport");
      const tag = t.unique("ls");
      const mine = [
        { sku: `${tag}-c`, name: "Clock", cents: 900, stock: 2, tags: [] },
        { sku: `${tag}-a`, name: "Atlas", cents: 1500, stock: 7, tags: [] },
        { sku: `${tag}-b`, name: "Bowl", cents: 300, stock: 2, tags: ["kitchen"] },
        { sku: `${tag}-d`, name: "Desk", cents: 9000, stock: 8, tags: [] },
      ];
      for (const p of mine) t.ok(await addProduct(t.baseUrl, p));
      const rows = t.ok<{ sku: string; name: string; stock: number }[]>(await lowStockReport(t.baseUrl, 8));
      const server = await t.http("GET", "/low-stock?below=8");
      t.equal(rows, server.body, "client parses what the server returns");
      t.equal(rows.filter((r) => r.sku.startsWith(`${tag}-`)), [
        { sku: `${tag}-b`, name: "Bowl", stock: 2 },
        { sku: `${tag}-c`, name: "Clock", stock: 2 },
        { sku: `${tag}-a`, name: "Atlas", stock: 7 },
      ]);
      for (let i = 1; i < rows.length; i++) {
        const [a, b] = [rows[i - 1], rows[i]];
        t.equal(a.stock < b.stock || (a.stock === b.stock && a.sku < b.sku), true, "sorted by stock, then sku");
      }
    },
  },
  {
    id: "lowStockReport-validation",
    tags: [],
    async run(t) {
      const { lowStockReport } = await t.feature("lowStockReport");
      t.fails(await lowStockReport(t.baseUrl, 0), "ValidationError");
      t.fails(await lowStockReport(t.baseUrl, 1001), "ValidationError");
    },
  },
];
