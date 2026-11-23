import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "addProduct-min-price-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Sticker", cents: 1, stock: 10, tags: [] };
      t.equal(t.ok(await addProduct(t.baseUrl, product)), product);
      t.equal((await t.http("GET", `/products/${sku}`)).body, product, "server copy");
    },
  },
  {
    id: "addProduct-min-price-rule",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      t.fails(await addProduct(t.baseUrl, { sku, name: "Free", cents: 0, stock: 1, tags: [] }), "ValidationError");
      t.fails(await addProduct(t.baseUrl, { sku, name: "Free", cents: -3, stock: 1, tags: [] }), "ValidationError");
      t.equal((await t.http("GET", `/products/${sku}`)).status, 400, "nothing was saved");
    },
  },
];
