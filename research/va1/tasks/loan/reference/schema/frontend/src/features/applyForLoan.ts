import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type LoanApplication = components["schemas"]["LoanApplication"];

/** Apply for a loan. The schema carries the three ranges; the cover rule is written here too. */
export async function applyForLoan(baseUrl: string, input: LoanApplication): Promise<Outcome<LoanApplication>> {
  return send(baseUrl, "POST", "/loans", "LoanApplication", input, (i: LoanApplication) => (i.monthly_payment * i.months < i.principal ? "the payments must cover the principal" : null));
}
