import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type TransferRequest = components["schemas"]["TransferRequest"];
type Transfer = components["schemas"]["Transfer"];

/** Make a transfer. The schema carries the single-field rules; the rules over several fields are written here too. */
export async function makeTransfer(baseUrl: string, input: TransferRequest): Promise<Outcome<Transfer>> {
  return send(baseUrl, "POST", "/transfers", "TransferRequest", input, (i: TransferRequest) => {
    if (i.from_account === i.to_account) return "from_account and to_account must differ";
    if (i.amount > i.balance) return "amount must be at most balance";
    return null;
  });
}
