import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "productsInPriceRange-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { productsInPriceRange } = await t.feature("productsInPriceRange");
      // prices no other client test uses, so the range holds only these products
      const base = 7_000_000 + (process.pid % 1000) * 1000;
      const mine = [
        { sku: t.unique("c"), name: "Clock", cents: base + 5, stock: 1, tags: ["home"] },
        { sku: t.unique("a"), name: "Atlas", cents: base + 3, stock: 2, tags: [] },
        { sku: t.unique("b"), name: "Bowl", cents: base + 3, stock: 3, tags: [] },
        { sku: t.unique("d"), name: "Desk", cents: base + 9, stock: 1, tags: [] },
      ];
      for (const p of mine) t.ok(await addProduct(t.baseUrl, p));
      const found = t.ok<unknown[]>(await productsInPriceRange(t.baseUrl, base + 3, base + 5));
      t.equal(found, [mine[1], mine[2], mine[0]]);
      const server = await t.http("GET", `/price-range?min_cents=${base + 3}&max_cents=${base + 5}`);
      t.equal(found, server.body, "client parses what the server returns");
      t.equal(t.ok(await productsInPriceRange(t.baseUrl, base + 6, base + 8)), []);
    },
  },
  {
    id: "productsInPriceRange-validation",
    tags: [],
    async run(t) {
      const { productsInPriceRange } = await t.feature("productsInPriceRange");
      t.fails(await productsInPriceRange(t.baseUrl, -1, 100), "ValidationError");
      t.fails(await productsInPriceRange(t.baseUrl, 50, 49), "ValidationError");
    },
  },
];
