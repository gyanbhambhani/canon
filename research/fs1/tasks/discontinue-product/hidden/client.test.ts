import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "discontinueProduct-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listProducts } = await t.feature("listProducts");
      const { discontinueProduct } = await t.feature("discontinueProduct");
      const tag = t.unique("tag");
      const made = ["a", "b", "c"].map((s) => ({ sku: `${tag}-${s}`, name: s.toUpperCase(), cents: 300, stock: 2, tags: [tag] }));
      for (const p of made) t.ok(await addProduct(t.baseUrl, p));
      const gone = t.ok(await discontinueProduct(t.baseUrl, made[1].sku));
      t.equal(gone, made[1]);
      t.equal(gone, (await t.http("GET", `/products/${made[1].sku}`)).body, "the client parses what the server returns");
      t.equal(t.ok(await discontinueProduct(t.baseUrl, made[1].sku)), made[1], "a second time");
      const listed = t.ok<{ sku: string }[]>(await listProducts(t.baseUrl, tag, 1, 10));
      t.equal(listed.map((p) => p.sku), [made[0].sku, made[2].sku]);
    },
  },
  {
    id: "discontinueProduct-missing",
    tags: [],
    async run(t) {
      const { discontinueProduct } = await t.feature("discontinueProduct");
      const sku = t.unique("none");
      t.equal(t.fails(await discontinueProduct(t.baseUrl, sku), "Missing").sku, sku);
    },
  },
];
