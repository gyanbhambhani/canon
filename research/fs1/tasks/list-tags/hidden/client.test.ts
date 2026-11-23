import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "listTags-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listTags } = await t.feature("listTags");
      const tag = t.unique("lt");
      const [a, b, c] = [`${tag}-a`, `${tag}-b`, `${tag}-c`];
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("s"), name: "One", cents: 100, stock: 1, tags: [c, a] }));
      t.ok(await addProduct(t.baseUrl, { sku: t.unique("s"), name: "Two", cents: 200, stock: 1, tags: [a, b, b] }));
      const tags = t.ok<string[]>(await listTags(t.baseUrl));
      const server = await t.http("GET", "/tags");
      t.equal(tags, server.body, "client parses what the server returns");
      t.equal(tags.filter((x) => x.startsWith(`${tag}-`)), [a, b, c]);
      t.equal(new Set(tags).size, tags.length, "each tag once");
      t.equal([...tags].sort(), tags, "sorted");
    },
  },
];
