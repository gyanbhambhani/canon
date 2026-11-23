import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "searchProducts-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { searchProducts } = await t.feature("searchProducts");
      const word = t.unique("zq");
      const b = { sku: t.unique("b"), name: `Blue ${word} mug`, cents: 900, stock: 2, tags: ["kitchen"] };
      const a = { sku: t.unique("a"), name: `${word.toUpperCase()} kettle`, cents: 2500, stock: 1, tags: [] };
      t.ok(await addProduct(t.baseUrl, b));
      t.ok(await addProduct(t.baseUrl, a));
      const found = t.ok<unknown[]>(await searchProducts(t.baseUrl, word));
      t.equal(found, [a, b].sort((x, y) => (x.sku < y.sku ? -1 : 1)));
      const server = await t.http("GET", `/search?q=${encodeURIComponent(word)}`);
      t.equal(found, server.body, "client parses what the server returns");
      t.equal(t.ok(await searchProducts(t.baseUrl, `${word} kettle!`)), []);
    },
  },
  {
    id: "searchProducts-validation",
    tags: [],
    async run(t) {
      const { searchProducts } = await t.feature("searchProducts");
      t.fails(await searchProducts(t.baseUrl, "a"), "ValidationError");
      t.fails(await searchProducts(t.baseUrl, "x".repeat(51)), "ValidationError");
    },
  },
];
