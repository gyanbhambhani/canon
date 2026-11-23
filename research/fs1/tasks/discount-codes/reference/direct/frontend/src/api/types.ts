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

/** A discount code: an order's total drops by this percentage. */
export interface Discount {
  code: string;
  percent: number;
}

/** Every error the API sends: {"error": {"kind": ...}}. */
export interface ApiError {
  kind: string;
  [field: string]: unknown;
}
