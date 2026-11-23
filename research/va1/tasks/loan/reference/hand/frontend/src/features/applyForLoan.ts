import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface LoanApplication {
  principal: number;
  months: number;
  monthly_payment: number;
}


/** Apply for a loan. */
export async function applyForLoan(baseUrl: string, input: LoanApplication): Promise<Outcome<LoanApplication>> {
  if (!Number.isInteger(input.principal) || input.principal < 1000 || input.principal > 1000000) return invalid("principal must be from 1000 to 1000000");
  if (!Number.isInteger(input.months) || input.months < 6 || input.months > 360) return invalid("months must be from 6 to 360");
  if (!Number.isInteger(input.monthly_payment) || input.monthly_payment < 1 || input.monthly_payment > 1000000) return invalid("monthly_payment must be from 1 to 1000000");
  if (input.monthly_payment * input.months < input.principal) return invalid("the payments must cover the principal");
  return call(baseUrl, "POST", "/loans", input);
}
