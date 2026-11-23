import { createClient } from "../canon/client";
import type { Transfer, TransferRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Make a transfer. */
export async function makeTransfer(baseUrl: string, input: TransferRequest): Promise<Outcome<Transfer>> {
  return createClient(baseUrl).makeTransfer(input);
}
