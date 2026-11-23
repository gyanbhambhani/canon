import { createClient } from "../canon/client";
import type { LoanApplication } from "../canon/types";
import type { Outcome } from "./result";

/** Apply for a loan. */
export async function applyForLoan(baseUrl: string, input: LoanApplication): Promise<Outcome<LoanApplication>> {
  return createClient(baseUrl).applyForLoan(input);
}
