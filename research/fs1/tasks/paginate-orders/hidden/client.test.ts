import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "listOrders-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { listOrders } = await t.feature("listOrders");
      const sku = t.unique("sku");
      const email = `${t.unique("c")}@example.com`;
      t.ok(await addProduct(t.baseUrl, { sku, name: "Jam", cents: 250, stock: 9, tags: [] }));
      const ids: number[] = [];
      for (let q = 1; q <= 3; q++) ids.push(t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: q }])).id);
      const page = t.ok<{ id: number }[]>(await listOrders(t.baseUrl, email, 2, 2));
      t.equal(page.map((o) => o.id), [ids[2]]);
      const server = await t.http("GET", `/orders?email=${encodeURIComponent(email)}&page=2&per_page=2`);
      t.equal(page, server.body, "client parses what the server returns");
    },
  },
  {
    id: "listOrders-validation",
    tags: [],
    async run(t) {
      const { listOrders } = await t.feature("listOrders");
      t.fails(await listOrders(t.baseUrl, "ada@example.com", 0, 5), "ValidationError");
      t.fails(await listOrders(t.baseUrl, "ada@example.com", 1, 21), "ValidationError");
    },
  },
];
