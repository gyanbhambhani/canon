/** Regression client tests: the starter's feature modules against the live backend, every arm. */
import type { ClientTest } from "../client-api";

export const tests: ClientTest[] = [
  {
    id: "addProduct-probe",
    tags: ["probe", "regression"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Kettle", cents: 2500, stock: 4, tags: ["kitchen"] };
      t.equal(t.ok(await addProduct(t.baseUrl, product)), product);
      t.equal((await t.http("GET", `/products/${sku}`)).body, product, "server copy");
    },
  },
  {
    id: "addProduct-errors",
    tags: ["regression"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const sku = t.unique("sku");
      const product = { sku, name: "Kettle", cents: 2500, stock: 4, tags: [] };
      t.ok(await addProduct(t.baseUrl, product));
      t.equal(t.fails(await addProduct(t.baseUrl, product), "Invalid").reason, `duplicate sku ${sku}`);
      t.fails(await addProduct(t.baseUrl, { ...product, sku: "ab" }), "ValidationError");
    },
  },
  {
    id: "listProducts-probe",
    tags: ["probe", "regression"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { listProducts } = await t.feature("listProducts");
      const tag = t.unique("tag");
      for (const s of ["b", "a", "c"]) t.ok(await addProduct(t.baseUrl, { sku: `${tag}-${s}`, name: s, cents: 1, stock: 1, tags: [tag] }));
      const page = t.ok<{ sku: string }[]>(await listProducts(t.baseUrl, tag, 1, 2));
      t.equal(page.map((p) => p.sku), [`${tag}-a`, `${tag}-b`]);
      const server = await t.http("GET", `/products?tag=${tag}&page=1&per_page=2`);
      t.equal(page, server.body, "client parses what the server returns");
      t.fails(await listProducts(t.baseUrl, null, 0, 2), "ValidationError");
    },
  },
  {
    id: "signup-probe",
    tags: ["probe", "regression"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const email = `${t.unique("u")}@example.com`;
      t.equal(t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse")), { email, name: "Ada" });
      t.equal(t.fails(await signup(t.baseUrl, email, "Ada", "correct horse"), "Taken").email, email);
      t.fails(await signup(t.baseUrl, "nope", "Ada", "correct horse"), "ValidationError");
    },
  },
  {
    id: "order-and-pay-probe",
    tags: ["probe", "regression"],
    async run(t) {
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const { payOrder } = await t.feature("payOrder");
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      const order = t.ok<{ id: number; total: number; status: unknown }>(await placeOrder(t.baseUrl, "ada@example.com", [{ sku, quantity: 2 }]));
      t.equal(order.total, 900);
      t.equal(order.status, { kind: "Open" });
      const paid = t.ok<{ status: unknown }>(await payOrder(t.baseUrl, order.id));
      t.equal(paid.status, { kind: "Paid", receipt: "test-receipt-900" });
      t.equal(t.fails(await placeOrder(t.baseUrl, "ada@example.com", [{ sku: t.unique("none"), quantity: 1 }]), "Missing").sku !== undefined, true);
    },
  },
];
