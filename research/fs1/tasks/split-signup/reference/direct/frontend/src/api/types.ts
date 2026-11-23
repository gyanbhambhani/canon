/** The shop API's request and response bodies, kept in step with backend/shop/schemas.py by hand. */

export interface Product {
  sku: string;
  name: string;
  cents: number;
  stock: number;
  tags: string[];
}

export interface Restock {
  amount: number;
}

export interface Signup {
  email: string;
  name: string;
  password: string;
}

export interface Profile {
  email: string;
  name: string;
}

/** A new account waiting for confirmation with its token. */
export interface Pending {
  email: string;
  token: string;
}

export interface Confirmation {
  token: string;
}

export interface Line {
  sku: string;
  quantity: number;
}

export type Status = { kind: "Open" } | { kind: "Paid"; receipt: string } | { kind: "Cancelled" };

export interface Order {
  id: number;
  email: string;
  lines: Line[];
  total: number;
  status: Status;
}

export interface NewOrder {
  email: string;
  lines: Line[];
}

export interface Summary {
  email: string;
  orders: number;
  spent: number;
}

/** Every error the API sends: {"error": {"kind": ...}}. */
export interface ApiError {
  kind: string;
  [field: string]: unknown;
}
