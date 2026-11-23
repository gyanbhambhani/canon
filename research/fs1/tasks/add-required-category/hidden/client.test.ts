/** Regression client tests with a required product category, plus its rule through addProduct. */
import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "addProduct-probe-category",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Kettle", cents: 2500, stock: 4, tags: ["kitchen"], category: "Kitchen ware" };
      t.equal(t.ok(await addProduct(t.baseUrl, product)), product);
      t.equal((await t.http("GET", `/products/${sku}`)).body, product, "server copy");
    },
  },
  {
    id: "addProduct-errors-category",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Kettle", cents: 2500, stock: 4, tags: [], category: "food" };
      t.ok(await addProduct(t.baseUrl, product));
      t.equal(t.fails(await addProduct(t.baseUrl, product), "Invalid").reason, `duplicate sku ${sku}`);
      t.fails(await addProduct(t.baseUrl, { ...product, sku: "ab" }), "ValidationError");
    },
  },
  {
    id: "addProduct-category-rule",
    tags: [],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Kettle", cents: 2500, stock: 4, tags: [], category: "  " };
      t.fails(await addProduct(t.baseUrl, product), "ValidationError");
      t.fails(await addProduct(t.baseUrl, { ...product, category: "" }), "ValidationError");
      t.equal((await t.http("GET", `/products/${sku}`)).status, 400, "nothing was saved");
    },
  },
  {
    id: "listProducts-probe-category",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listProducts } = await t.feature("listProducts");
      const tag = t.unique("tag");
      for (const s of ["b", "a", "c"]) {
        t.ok(await addProduct(t.baseUrl, { sku: `${tag}-${s}`, name: s, cents: 1, stock: 1, tags: [tag], category: `cat ${s}` }));
      }
      const page = t.ok<{ sku: string; category: string }[]>(await listProducts(t.baseUrl, tag, 1, 2));
      t.equal(page.map((p) => [p.sku, p.category]), [[`${tag}-a`, "cat a"], [`${tag}-b`, "cat b"]]);
      const server = await t.http("GET", `/products?tag=${tag}&page=1&per_page=2`);
      t.equal(page, server.body, "client parses what the server returns");
      t.fails(await listProducts(t.baseUrl, null, 0, 2), "ValidationError");
    },
  },
  {
    id: "order-and-pay-probe-category",
    tags: ["probe"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [], category: "kitchen" }));
      const order = t.ok<{ id: number; total: number; status: unknown }>(await placeOrder(t.baseUrl, "ada@example.com", [{ sku, quantity: 2 }]));
      t.equal(order.total, 900);
      t.equal(order.status, { kind: "Open" });
      const paid = t.ok<{ status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      t.equal(t.fails(await placeOrder(t.baseUrl, "ada@example.com", [{ sku: t.unique("none"), quantity: 1 }]), "Missing").sku !== undefined, true);
    },
  },
];
