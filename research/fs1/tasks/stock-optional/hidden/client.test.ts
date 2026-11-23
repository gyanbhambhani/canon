import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "addProduct-null-stock-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Fig", cents: 250, stock: null, tags: ["fruit"] };
      t.equal(t.ok(await addProduct(t.baseUrl, product)), product);
      t.equal((await t.http("GET", `/products/${sku}`)).body, product, "the server saved what the client sent");
      const known = { sku: t.unique("sku"), name: "Kiwi", cents: 90, stock: 0, tags: [] };
      t.equal(t.ok(await addProduct(t.baseUrl, known)), known);
    },
  },
  {
    id: "listProducts-null-stock-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listProducts } = await t.feature("listProducts");
      const tag = t.unique("tag");
      const a = { sku: `${tag}-a`, name: "A", cents: 1, stock: null, tags: [tag] };
      const b = { sku: `${tag}-b`, name: "B", cents: 2, stock: 4, tags: [tag] };
      t.ok(await addProduct(t.baseUrl, b));
      t.ok(await addProduct(t.baseUrl, a));
      const page = t.ok(await listProducts(t.baseUrl, tag, 1, 10));
      t.equal(page, [a, b]);
      t.equal(page, (await t.http("GET", `/products?tag=${tag}&page=1&per_page=10`)).body, "client parses what the server returns");
    },
  },
  {
    id: "addProduct-stock-errors",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      t.equal(t.fails(await addProduct(t.baseUrl, { sku, name: "Bad", cents: 5, stock: -1, tags: [] }), "Invalid").reason, "stock is negative");
      t.fails(await addProduct(t.baseUrl, { sku: "ab", name: "Bad", cents: 5, stock: null, tags: [] }), "ValidationError");
    },
  },
];
