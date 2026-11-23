import type { ClientTest } from "../../../harness/client-api";

async function product(t: Parameters<ClientTest["run"]>[0]): Promise<string> {
  const { addProduct } = await t.feature("addProduct");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Teapot", cents: 1200, stock: 3, tags: [] }));
  return sku;
}

export const tests: ClientTest[] = [
  {
    id: "rateProduct-probe",
    tags: ["probe"],
    async run(t) {
      const sku = await product(t);
      const { rateProduct } = await t.feature("rateProduct");
      t.equal(t.ok(await rateProduct(t.baseUrl, sku, 5)), { sku, count: 1, average: 5 });
      const second = t.ok(await rateProduct(t.baseUrl, sku, 2));
      t.equal(second, { sku, count: 2, average: 3.5 });
      t.equal(second, (await t.http("GET", `/products/${sku}/rating`)).body, "the server recorded what the client sent");
    },
  },
  {
    id: "productRating-probe",
    tags: ["probe"],
    async run(t) {
      const sku = await product(t);
      const { productRating } = await t.feature("productRating");
      t.equal(t.ok(await productRating(t.baseUrl, sku)), { sku, count: 0, average: null });
      for (const stars of [5, 4, 4]) await t.http("POST", `/products/${sku}/ratings`, { stars });
      const summary = t.ok<{ count: number; average: number }>(await productRating(t.baseUrl, sku));
      t.equal(summary, (await t.http("GET", `/products/${sku}/rating`)).body, "client parses what the server returns");
      t.equal(summary.count, 3);
      t.equal(Math.abs(summary.average - 13 / 3) < 1e-9, true, "average");
    },
  },
  {
    id: "rating-errors",
    tags: [],
    async run(t) {
      const sku = await product(t);
      const { rateProduct } = await t.feature("rateProduct");
      const { productRating } = await t.feature("productRating");
      t.fails(await rateProduct(t.baseUrl, sku, 0), "ValidationError");
      t.fails(await rateProduct(t.baseUrl, sku, 6), "ValidationError");
      const none = t.unique("none");
      t.equal(t.fails(await rateProduct(t.baseUrl, none, 3), "Missing").sku, none);
      t.equal(t.fails(await productRating(t.baseUrl, none), "Missing").sku, none);
    },
  },
];
