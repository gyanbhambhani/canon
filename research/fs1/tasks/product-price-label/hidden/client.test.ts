import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "productPriceLabel-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { productPriceLabel } = await t.feature("productPriceLabel");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Kettle", cents: 2507, stock: 4, tags: [] }));
      const label = t.ok(await productPriceLabel(t.baseUrl, sku));
      t.equal(label, { sku, name: "Kettle", price_label: "$25.07" });
      t.equal(label, (await t.http("GET", `/products/${sku}/label`)).body, "client parses what the server returns");
    },
  },
  {
    id: "productPriceLabel-missing",
    tags: [],
    async run(t) {
      const { productPriceLabel } = await t.feature("productPriceLabel");
      const sku = t.unique("none");
      t.equal(t.fails(await productPriceLabel(t.baseUrl, sku), "Missing").sku, sku);
    },
  },
];
