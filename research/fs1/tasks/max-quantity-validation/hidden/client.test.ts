import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "placeOrder-quantity-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const error = t.fails(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }, { sku, quantity: 100 }]), "BadQuantity");
      t.equal({ sku: error.sku, quantity: error.quantity }, { sku, quantity: 100 }, "the client parses the typed error");
      const server = await t.http("POST", "/orders", { email, lines: [{ sku, quantity: 100 }] });
      t.equal(server.status, 400);
      t.equal(server.body.error, { kind: "BadQuantity", sku, quantity: 100 }, "server ground truth");
      t.equal((await t.http("GET", `/orders/open?email=${encodeURIComponent(email)}`)).body, 0, "no order was created");
      const order = t.ok<{ total: number; lines: unknown }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 99 }]));
      t.equal(order.total, 450 * 99);
      t.equal(order.lines, [{ sku, quantity: 99 }]);
    },
  },
  {
    id: "placeOrder-quantity-zero",
    tags: [],
    async run(t) {
      const { placeOrder } = await t.feature("placeOrder");
      const sku = t.unique("none");
      const error = t.fails(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 0 }]), "BadQuantity");
      t.equal(error.quantity, 0);
    },
  },
];
