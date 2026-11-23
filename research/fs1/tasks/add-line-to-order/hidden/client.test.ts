import type { ClientTest } from "../../../harness/client-api";

type Ctx = Parameters<ClientTest["run"]>[0];

async function placed(t: Ctx, sku: string) {
  const { addProduct } = await t.feature("addProduct");
  const { placeOrder } = await t.feature("placeOrder");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
  return t.ok<{ id: number; total: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 1 }]));
}

export const tests: ClientTest[] = [
  {
    id: "addLine-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { addLine } = await t.feature("addLine");
      const tea = t.unique("sku");
      const cake = t.unique("sku");
      const order = await placed(t, tea);
      t.ok(await addProduct(t.baseUrl, { sku: cake, name: "Cake", cents: 450, stock: 5, tags: [] }));
      const grown = t.ok(await addLine(t.baseUrl, order.id, tea, 2));
      t.equal(grown, { ...order, lines: [{ sku: tea, quantity: 3 }], total: 900 });
      const added = t.ok(await addLine(t.baseUrl, order.id, cake, 1));
      t.equal(added, { ...order, lines: [{ sku: tea, quantity: 3 }, { sku: cake, quantity: 1 }], total: 1350 });
      const server = await t.http("POST", `/orders/${order.id}/pay`);
      t.equal(server.body.lines, added.lines, "the server saved the lines the client sent");
      t.equal(server.body.total, 1350, "the server saved the new total");
    },
  },
  {
    id: "addLine-errors",
    tags: [],
    async run(t) {
      const { addLine } = await t.feature("addLine");
      const { payOrder } = await t.feature("payOrder");
      const tea = t.unique("sku");
      const order = await placed(t, tea);
      t.fails(await addLine(t.baseUrl, order.id, tea, 0), "ValidationError");
      t.equal(t.fails(await addLine(t.baseUrl, 987654, tea, 1), "Missing").sku, "order 987654");
      const none = t.unique("none");
      t.equal(t.fails(await addLine(t.baseUrl, order.id, none, 1), "Missing").sku, none);
      t.ok(await payOrder(t.baseUrl, order.id));
      t.equal(t.fails(await addLine(t.baseUrl, order.id, tea, 1), "Invalid").reason, `order ${order.id} is not open`);
    },
  },
];
