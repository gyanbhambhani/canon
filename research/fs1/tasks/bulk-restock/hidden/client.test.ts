import type { ClientTest } from "../../../harness/client-api";

async function two(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const a = { sku: t.unique("sku"), name: "Tea", cents: 300, stock: 4, tags: [] };
  const b = { sku: t.unique("sku"), name: "Jam", cents: 250, stock: 1, tags: ["sweet"] };
  t.ok(await addProduct(t.baseUrl, a));
  t.ok(await addProduct(t.baseUrl, b));
  return [a, b];
}

export const tests: ClientTest[] = [
  {
    id: "bulkRestock-probe",
    tags: ["probe"],
    async run(t) {
      const { bulkRestock } = await t.feature("bulkRestock");
      const [a, b] = await two(t);
      const updated = t.ok(await bulkRestock(t.baseUrl, [{ sku: b.sku, amount: 6 }, { sku: a.sku, amount: 1 }, { sku: b.sku, amount: 3 }]));
      t.equal(updated, [{ ...b, stock: 10 }, { ...a, stock: 5 }, { ...b, stock: 10 }]);
      t.equal((await t.http("GET", `/products/${b.sku}`)).body, { ...b, stock: 10 }, "the server saved what the client sent");
      t.equal((await t.http("GET", `/products/${a.sku}`)).body, { ...a, stock: 5 }, "the server saved what the client sent");
    },
  },
  {
    id: "bulkRestock-all-or-nothing",
    tags: [],
    async run(t) {
      const { bulkRestock } = await t.feature("bulkRestock");
      const [a, b] = await two(t);
      const missing = t.unique("none");
      t.equal(t.fails(await bulkRestock(t.baseUrl, [{ sku: a.sku, amount: 2 }, { sku: missing, amount: 1 }]), "Missing").sku, missing);
      const bad = t.fails(await bulkRestock(t.baseUrl, [{ sku: a.sku, amount: 2 }, { sku: b.sku, amount: 0 }]), "Invalid");
      t.equal(bad.reason, `amount for ${b.sku} is not positive`);
      t.equal((await t.http("GET", `/products/${a.sku}`)).body, a, "nothing changed");
      t.fails(await bulkRestock(t.baseUrl, []), "ValidationError");
    },
  },
];
