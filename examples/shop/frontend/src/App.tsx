import { useCallback, useEffect, useState } from "react";
import { createClient } from "./canon/client";
import type { TransportError, ValidationError } from "./canon/runtime";
import type { CatalogError, Order, Product, Profile, UserError } from "./canon/types";

const api = createClient("/api");
const PER_PAGE = 2;

type AnyError = CatalogError | UserError | ValidationError | TransportError;

/** One message for every error the generated client can return. */
function describe(error: AnyError): string {
  switch (error.kind) {
    case "Missing":
      return `Not found: ${error.sku}`;
    case "Invalid":
      return `Invalid: ${error.reason}`;
    case "Taken":
      return `${error.email} already has an account.`;
    case "BadLogin":
      return "Wrong email or password.";
    case "ValidationError":
      return `Not allowed: ${error.rule}`;
    case "TransportError":
      return `The server could not be reached (${error.message}).`;
  }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function App() {
  const [user, setUser] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [tag, setTag] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const report = (e: AnyError) => setError(describe(e));

  const load = useCallback(async () => {
    const result = await api.listProducts(tag === "" ? null : tag, page, PER_PAGE);
    if (result.ok) setProducts(result.value);
    else setError(describe(result.error));
  }, [page, tag]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signup(form: FormData) {
    const result = await api.signup({
      email: String(form.get("email")),
      name: String(form.get("name")),
      password: String(form.get("password")),
    });
    if (result.ok) {
      setUser(result.value);
      setError(null);
    } else report(result.error);
  }

  async function addProduct(form: FormData) {
    const result = await api.addProduct({
      sku: String(form.get("sku")),
      name: String(form.get("name")),
      cents: Number(form.get("cents")),
      stock: Number(form.get("stock")),
      tags: String(form.get("tags"))
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t !== ""),
    });
    if (result.ok) {
      setError(null);
      await load();
    } else report(result.error);
  }

  async function buy(sku: string) {
    if (!user) return;
    const result = await api.placeOrder({ email: user.email, lines: [{ sku, quantity: 1 }] });
    if (result.ok) {
      setOrder(result.value);
      setError(null);
    } else report(result.error);
  }

  async function pay() {
    if (!order) return;
    const result = await api.pay(order.id);
    if (result.ok) setOrder(result.value);
    else report(result.error);
  }

  return (
    <main>
      <h1>Shop</h1>
      {error && <p role="alert">{error}</p>}

      <section aria-label="Account">
        {user ? (
          <p>Signed in as {user.name}</p>
        ) : (
          <form action={signup}>
            <input name="email" aria-label="Email" />
            <input name="name" aria-label="Name" />
            <input name="password" aria-label="Password" type="password" />
            <button type="submit">Sign up</button>
          </form>
        )}
      </section>

      <section aria-label="Products">
        <h2>Products</h2>
        <input
          aria-label="Tag filter"
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setPage(1);
          }}
        />
        <ul>
          {products.map((p) => (
            <li key={p.sku}>
              {p.name} {money(p.cents)} {user && <button onClick={() => void buy(p.sku)}>Buy {p.name}</button>}
            </li>
          ))}
        </ul>
        <nav>
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span> Page {page} </span>
          <button disabled={products.length < PER_PAGE} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </nav>
        <form action={addProduct}>
          <input name="sku" aria-label="SKU" />
          <input name="name" aria-label="Product name" />
          <input name="cents" aria-label="Price in cents" />
          <input name="stock" aria-label="Stock" />
          <input name="tags" aria-label="Tags" />
          <button type="submit">Add product</button>
        </form>
      </section>

      {order && (
        <section aria-label="Order">
          <h2>Order {order.id}</h2>
          <p>Total {money(order.total)}</p>
          <p>Status: {order.status.kind === "Paid" ? `Paid (${order.status.receipt})` : order.status.kind}</p>
          {order.status.kind === "Open" && <button onClick={() => void pay()}>Pay</button>}
        </section>
      )}
    </main>
  );
}
