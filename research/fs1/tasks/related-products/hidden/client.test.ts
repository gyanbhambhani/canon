import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "relatedProducts-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { relatedProducts } = await t.feature("relatedProducts");
      const tag = t.unique("rp");
      const [x, y, z] = [`${tag}-x`, `${tag}-y`, `${tag}-z`];
      const main = { sku: `${tag}-main`, name: "Teapot", cents: 2000, stock: 3, tags: [x, y, z] };
      const two = { sku: `${tag}-d`, name: "Cup", cents: 400, stock: 9, tags: [y, x, "kitchen"] };
      const oneA = { sku: `${tag}-a`, name: "Tray", cents: 900, stock: 1, tags: [z] };
      const oneC = { sku: `${tag}-c`, name: "Tea", cents: 600, stock: 4, tags: [x, x] };
      const none = { sku: `${tag}-b`, name: "Spoon", cents: 100, stock: 7, tags: ["kitchen"] };
      for (const p of [main, two, oneA, oneC, none]) t.ok(await addProduct(t.baseUrl, p));
      const found = t.ok<unknown[]>(await relatedProducts(t.baseUrl, main.sku));
      t.equal(found, [two, oneA, oneC]);
      const server = await t.http("GET", `/products/${main.sku}/related`);
      t.equal(found, server.body, "client parses what the server returns");
    },
  },
  {
    id: "relatedProducts-missing",
    tags: [],
    async run(t) {
      const { relatedProducts } = await t.feature("relatedProducts");
      const sku = t.unique("gone");
      t.equal(t.fails(await relatedProducts(t.baseUrl, sku), "Missing").sku, sku);
    },
  },
];
