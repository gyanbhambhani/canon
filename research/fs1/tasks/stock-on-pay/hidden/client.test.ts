import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "payOrder-stock-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 5, tags: [] }));
      const order = t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 2 }]));
      const paid = t.ok(await payOrder(t.baseUrl, order.id));
      t.equal(paid, { ...order, status: { kind: "Paid", receipt: "test-receipt-900" } });
      t.equal((await t.http("GET", `/products/${sku}`)).body.stock, 3, "the server took the stock");
      t.equal(t.fails(await payOrder(t.baseUrl, order.id), "Invalid").reason, `order ${order.id} is paid`);
      t.equal((await t.http("GET", `/products/${sku}`)).body.stock, 3, "paying again takes nothing");
    },
  },
  {
    id: "payOrder-out-of-stock",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 1, tags: [] }));
      const order = t.ok<{ id: number }>(await placeOrder(t.baseUrl, `${t.unique("u")}@example.com`, [{ sku, quantity: 4 }]));
      const error = t.fails(await payOrder(t.baseUrl, order.id), "OutOfStock");
      t.equal({ sku: error.sku, available: error.available }, { sku, available: 1 });
      t.equal((await t.http("GET", `/products/${sku}`)).body.stock, 1, "stock unchanged");
    },
  },
];
