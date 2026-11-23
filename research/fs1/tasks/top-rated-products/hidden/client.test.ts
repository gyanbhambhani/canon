import type { ClientTest } from "../../../harness/client-api";

type Row = { sku: string; name: string; average: number; count: number };

async function product(t: Parameters<ClientTest["run"]>[0], name: string): Promise<string> {
  const { addProduct } = await t.feature("addProduct");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name, cents: 700, stock: 2, tags: [] }));
  return sku;
}

function sorted(rows: Row[]): boolean {
  return rows.every((r, i) => i === 0 || rows[i - 1].average > r.average || (rows[i - 1].average === r.average && rows[i - 1].sku < r.sku));
}

export const tests: ClientTest[] = [
  {
    id: "rateProduct-probe",
    tags: ["probe"],
    async run(t) {
      const sku = await product(t, "Teapot");
      const { rateProduct } = await t.feature("rateProduct");
      t.equal(t.ok(await rateProduct(t.baseUrl, sku, 4)), { sku, count: 1, average: 4 });
      t.equal(t.ok(await rateProduct(t.baseUrl, sku, 5)), { sku, count: 2, average: 4.5 });
      const server = await t.http("POST", `/products/${sku}/ratings`, { stars: 3 });
      t.equal(server.body, { sku, count: 3, average: 4 }, "the server recorded what the client sent");
    },
  },
  {
    id: "topRatedProducts-probe",
    tags: ["probe"],
    async run(t) {
      const { topRatedProducts } = await t.feature("topRatedProducts");
      const best = await product(t, "Best");
      const good = await product(t, "Good");
      await product(t, "Unrated");
      for (const stars of [5, 5]) await t.http("POST", `/products/${best}/ratings`, { stars });
      for (const stars of [5, 4]) await t.http("POST", `/products/${good}/ratings`, { stars });
      const rows = t.ok<Row[]>(await topRatedProducts(t.baseUrl, 20));
      t.equal(rows, (await t.http("GET", "/top-rated?limit=20")).body, "client parses what the server returns");
      t.equal(sorted(rows), true, "rows are sorted by average, then sku");
      t.equal(rows.find((r) => r.sku === best), { sku: best, name: "Best", average: 5, count: 2 });
      t.equal(rows.find((r) => r.sku === good), { sku: good, name: "Good", average: 4.5, count: 2 });
      t.equal(rows.filter((r) => r.name === "Unrated").length, 0, "unrated products are left out");
      t.equal(t.ok<Row[]>(await topRatedProducts(t.baseUrl, 1)), rows.slice(0, 1));
    },
  },
  {
    id: "top-rated-errors",
    tags: [],
    async run(t) {
      const { rateProduct } = await t.feature("rateProduct");
      const { topRatedProducts } = await t.feature("topRatedProducts");
      const sku = await product(t, "Mug");
      t.fails(await rateProduct(t.baseUrl, sku, 6), "ValidationError");
      t.fails(await rateProduct(t.baseUrl, sku, 0), "ValidationError");
      const none = t.unique("none");
      t.equal(t.fails(await rateProduct(t.baseUrl, none, 3), "Missing").sku, none);
      t.fails(await topRatedProducts(t.baseUrl, 0), "ValidationError");
      t.fails(await topRatedProducts(t.baseUrl, 21), "ValidationError");
    },
  },
];
