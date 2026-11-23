import type { ClientTest } from "../../../harness/client-api";

async function placed(t: Parameters<ClientTest["run"]>[0]) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
  return t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
}

export const tests: ClientTest[] = [
  {
    id: "setOrderNote-probe",
    tags: ["probe"],
    async run(t) {
      const order = await placed(t);
      const { setOrderNote } = await t.feature("setOrderNote");
      const note = " ring twice ";
      t.equal(t.ok(await setOrderNote(t.baseUrl, order.id, note)), { id: order.id, note });
      t.equal((await t.http("GET", `/orders/${order.id}/note`)).body, { id: order.id, note }, "the server saved what the client sent");
    },
  },
  {
    id: "getOrderNote-probe",
    tags: ["probe"],
    async run(t) {
      const order = await placed(t);
      const { getOrderNote } = await t.feature("getOrderNote");
      t.equal(t.ok(await getOrderNote(t.baseUrl, order.id)), { id: order.id, note: "" });
      await t.http("PUT", `/orders/${order.id}/note`, { note: "leave at door" });
      const got = t.ok(await getOrderNote(t.baseUrl, order.id));
      t.equal(got, { id: order.id, note: "leave at door" });
      t.equal(got, (await t.http("GET", `/orders/${order.id}/note`)).body, "client parses what the server returns");
    },
  },
  {
    id: "orderNote-errors",
    tags: [],
    async run(t) {
      const order = await placed(t);
      const { setOrderNote } = await t.feature("setOrderNote");
      const { getOrderNote } = await t.feature("getOrderNote");
      t.fails(await setOrderNote(t.baseUrl, order.id, "   "), "ValidationError");
      t.fails(await setOrderNote(t.baseUrl, order.id, "z".repeat(51)), "ValidationError");
      t.equal(t.fails(await setOrderNote(t.baseUrl, 987654, "hello"), "Missing").sku, "order 987654");
      t.equal(t.fails(await getOrderNote(t.baseUrl, 987654), "Missing").sku, "order 987654");
    },
  },
];
