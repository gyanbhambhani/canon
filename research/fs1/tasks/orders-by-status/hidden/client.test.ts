import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "listOrdersByStatus-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const { listOrdersByStatus } = await t.feature("listOrdersByStatus");
      const sku = t.unique("sku");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await addProduct(t.baseUrl, { sku, name: "Tea", cents: 300, stock: 5, tags: [] }));
      const open = t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      const toPay = t.ok<{ id: number }>(await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }]));
      const paid = t.ok(await payOrder(t.baseUrl, toPay.id));

      const openList = t.ok<{ id: number; email: string }[]>(await listOrdersByStatus(t.baseUrl, "Open"));
      t.equal(openList, (await t.http("GET", "/orders/by-status?status=Open")).body, "client parses what the server returns");
      t.equal(openList.filter((o) => o.email === email), [open]);
      const paidList = t.ok<{ id: number; email: string }[]>(await listOrdersByStatus(t.baseUrl, "Paid"));
      t.equal(paidList.filter((o) => o.email === email), [paid]);
      const ids = paidList.map((o) => o.id);
      t.equal(ids, [...ids].sort((a, b) => a - b), "oldest first");
      t.equal(Array.isArray(t.ok(await listOrdersByStatus(t.baseUrl, "Cancelled"))), true);
    },
  },
  {
    id: "listOrdersByStatus-invalid",
    tags: [],
    async run(t) {
      const { listOrdersByStatus } = await t.feature("listOrdersByStatus");
      t.fails(await listOrdersByStatus(t.baseUrl, "paid"), "ValidationError");
      t.fails(await listOrdersByStatus(t.baseUrl, "Shipped"), "ValidationError");
    },
  },
];
