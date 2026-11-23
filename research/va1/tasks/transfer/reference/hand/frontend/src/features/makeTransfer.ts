import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface TransferRequest {
  from_account: string;
  to_account: string;
  amount: number;
  balance: number;
}

export interface Transfer extends TransferRequest {
  remaining: number;
}

/** Make a transfer. */
export async function makeTransfer(baseUrl: string, input: TransferRequest): Promise<Outcome<Transfer>> {
  const fromLength = [...input.from_account].length;
  if (fromLength < 1 || fromLength > 20) return invalid("from_account must have 1 to 20 characters");
  const toLength = [...input.to_account].length;
  if (toLength < 1 || toLength > 20) return invalid("to_account must have 1 to 20 characters");
  if (input.from_account === input.to_account) return invalid("from_account and to_account must differ");
  if (!Number.isInteger(input.amount) || input.amount < 1) return invalid("amount must be at least 1");
  if (!Number.isInteger(input.balance) || input.balance < 0) return invalid("balance must be at least 0");
  if (input.amount > input.balance) return invalid("amount must be at most balance");
  return call(baseUrl, "POST", "/transfers", input);
}
