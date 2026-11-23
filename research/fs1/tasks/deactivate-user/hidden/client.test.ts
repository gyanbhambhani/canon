import type { ClientTest } from "../../../harness/client-api";

export const tests: ClientTest[] = [
  {
    id: "deactivateUser-probe",
    tags: ["probe"],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { deactivateUser } = await t.feature("deactivateUser");
      const email = `${t.unique("u")}@example.com`;
      t.ok(await signup(t.baseUrl, email, " Ada ", "correct horse"));
      t.equal(t.ok(await deactivateUser(t.baseUrl, email)), { email, name: "Ada" });
      const login = await t.http("POST", "/login", { email, name: "", password: "correct horse" });
      t.equal(login.status, 400, "login status after deactivation");
      t.equal(login.body, { error: { kind: "Deactivated", email } }, "the server deactivated the account the client named");
      t.equal(t.ok(await deactivateUser(t.baseUrl, email)), { email, name: "Ada" }, "deactivating again");
    },
  },
  {
    id: "deactivateUser-orders",
    tags: [],
    async run(t) {
      const { signup } = await t.feature("signup");
      const { deactivateUser } = await t.feature("deactivateUser");
      const { addProduct } = await t.feature("addProduct");
      const { placeOrder } = await t.feature("placeOrder");
      const email = `${t.unique("u")}@example.com`;
      const sku = t.unique("sku");
      t.ok(await addProduct(t.baseUrl, { sku, name: "Mug", cents: 450, stock: 9, tags: [] }));
      t.ok(await signup(t.baseUrl, email, "Ada", "correct horse"));
      t.ok(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]));
      t.ok(await deactivateUser(t.baseUrl, email));
      t.equal(t.fails(await placeOrder(t.baseUrl, email, [{ sku, quantity: 1 }]), "Deactivated").email, email);
    },
  },
  {
    id: "deactivateUser-errors",
    tags: [],
    async run(t) {
      const { deactivateUser } = await t.feature("deactivateUser");
      const email = `${t.unique("nobody")}@example.com`;
      t.equal(t.fails(await deactivateUser(t.baseUrl, email), "NoSuchUser").email, email);
    },
  },
];
