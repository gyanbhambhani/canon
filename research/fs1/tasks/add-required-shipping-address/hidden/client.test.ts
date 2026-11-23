import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "order-with-address-probe",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      const order = t.ok<{ id: number; shipping_address: string; total: number; status: unknown }>(
        await placeOrder(t.baseUrl, email, [{ sku, quantity: 2 }], " 12 Elm Road "),
      );
      t.equal(order.shipping_address, "12 Elm Road", "the server stored the address the client sent");
      t.equal(order.total, 900);
      t.equal(order.status, { kind: "Open" });
      const paid = t.ok<{ shipping_address: string; status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.shipping_address, "12 Elm Road", "the client parses the paid order");
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      t.equal(t.fails(await placeOrder(t.baseUrl, email, [{ sku: t.unique("none"), quantity: 1 }], "12 Elm Road"), "Missing").sku !== undefined, true);
    },
  },
  {
    id: "order-address-rule",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const email = `${t.unique("u")}@example.com`;
      t.fails(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }], "  ab "), "ValidationError");
      t.fails(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }], ""), "ValidationError");
      const open = await t.http("GET", `/orders/open?email=${encodeURIComponent(email)}`);
      t.equal(open.body, 0, "no order was created");
    },
  },
];
