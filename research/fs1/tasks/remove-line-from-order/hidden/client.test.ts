import type { ClientTest } from "../../../harness/client-api";

type Ctx = Parameters<ClientTest["run"]>[0];

async function placed(t: Ctx) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  const tea = t.unique("sku");
  const cake = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku: tea, name: "Tea", cents: 300, stock: 5, tags: [] }));
  t.ok(await addProduct(t.baseUrl, { sku: cake, name: "Cake", cents: 450, stock: 5, tags: [] }));
  const lines = [{ sku: tea, quantity: 2 }, { sku: cake, quantity: 1 }];
  const order = t.ok<{ id: number; total: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, lines));
  return { order, tea, cake };
}

export const tests: ClientTest[] = [
  {
    id: "removeLine-probe",
    tags: ["probe"],
    async run(t) {
      const { removeLine } = await t.feature("removeLine");
      const { order, tea, cake } = await placed(t);
      t.equal(order.total, 1050);
      const updated = t.ok(await removeLine(t.baseUrl, order.id, tea));
      t.equal(updated, { ...order, lines: [{ sku: cake, quantity: 1 }], total: 450 });
      const server = await t.http("POST", `/orders/${order.id}/pay`);
      t.equal(server.body.lines, updated.lines, "the server removed the line the client named");
      t.equal(server.body.total, 450);
    },
  },
  {
    id: "removeLine-errors",
    tags: [],
    async run(t) {
      const { removeLine } = await t.feature("removeLine");
      const { payOrder } = await t.feature("payOrder");
      const { order, tea, cake } = await placed(t);
      t.equal(t.fails(await removeLine(t.baseUrl, 987654, tea), "Missing").sku, "order 987654");
      const none = t.unique("none");
      t.equal(t.fails(await removeLine(t.baseUrl, order.id, none), "Missing").sku, none);
      t.ok(await removeLine(t.baseUrl, order.id, tea));
      t.equal(t.fails(await removeLine(t.baseUrl, order.id, cake), "Invalid").reason, `order ${order.id} would be empty`);
      t.ok(await payOrder(t.baseUrl, order.id));
      t.equal(t.fails(await removeLine(t.baseUrl, order.id, cake), "Invalid").reason, `order ${order.id} is not open`);
    },
  },
];
