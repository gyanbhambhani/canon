import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "productCountByTag-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { productCountByTag } = await t.feature("productCountByTag");
      const tag = t.unique("pc");
      const [a, b, c] = [`${tag}-a`, `${tag}-b`, `${tag}-c`];
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("s"), name: "One", cents: 100, stock: 1, tags: [c, a] }));
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("s"), name: "Two", cents: 200, stock: 1, tags: [a, b, b] }));
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("s"), name: "Three", cents: 300, stock: 1, tags: [a] }));
      const rows = t.ok<{ tag: string; count: number }[]>(await productCountByTag(t.baseUrl));
      const server = await t.http("GET", "/tags/counts");
      t.equal(rows, server.body, "client parses what the server returns");
      t.equal(rows.filter((r) => r.tag.startsWith(`${tag}-`)), [
        { tag: a, count: 3 },
        { tag: b, count: 1 },
        { tag: c, count: 1 },
      ]);
      t.equal([...rows.map((r) => r.tag)].sort(), rows.map((r) => r.tag), "sorted by tag");
    },
  },
];
