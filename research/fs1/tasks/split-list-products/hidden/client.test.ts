import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "listTaggedProducts-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listTaggedProducts } = await t.feature("listTaggedProducts");
      const tag = t.unique("tag");
      for (const s of ["b", "a", "c"]) t.ok(await addProduct(t.baseUrl, { sku: `${tag}-${s}`, name: s, cents: 1, stock: 1, tags: ["x", tag] }));
      const page = t.ok<{ sku: string }[]>(await listTaggedProducts(t.baseUrl, tag, 1, 2));
      t.equal(page.map((p) => p.sku), [`${tag}-a`, `${tag}-b`]);
      const server = await t.http("GET", `/tags/${tag}/products?page=1&per_page=2`);
      t.equal(page, server.body, "client parses what the server returns");
      t.equal(t.ok<{ sku: string }[]>(await listTaggedProducts(t.baseUrl, tag, 2, 2)).map((p) => p.sku), [`${tag}-c`]);
      t.fails(await listTaggedProducts(t.baseUrl, tag, 0, 2), "ValidationError");
      t.fails(await listTaggedProducts(t.baseUrl, tag, 1, 51), "ValidationError");
    },
  },
  {
    id: "listTaggedProducts-spaces",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listTaggedProducts } = await t.feature("listTaggedProducts");
      const tag = `${t.unique("on sale")} %`;
      const product = { sku: t.unique("sku"), name: "Pan", cents: 1, stock: 1, tags: [tag] };
      t.ok(await addProduct(t.baseUrl, product));
      t.equal(t.ok(await listTaggedProducts(t.baseUrl, tag, 1, 5)), [product]);
    },
  },
  {
    id: "listProducts-probe-split",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listProducts } = await t.feature("listProducts");
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("sku"), name: "Cup", cents: 1, stock: 1, tags: [] }));
      const page = t.ok<{ sku: string }[]>(await listProducts(t.baseUrl, 1, 3));
      t.equal(page.length, 3);
      const server = await t.http("GET", "/products?page=1&per_page=3");
      t.equal(page, server.body, "client parses what the server returns");
      const skus = page.map((p) => p.sku);
      t.equal(skus, [...skus].sort(), "sorted by sku");
      t.fails(await listProducts(t.baseUrl, 0, 2), "ValidationError");
      t.fails(await listProducts(t.baseUrl, 1, 0), "ValidationError");
    },
  },
];
