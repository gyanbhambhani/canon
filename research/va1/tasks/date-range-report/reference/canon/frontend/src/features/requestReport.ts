import { createClient } from "../canon/client";
import type { ReportRange } from "../canon/types";
import type { Outcome } from "./result";

/** Request a range report. */
export async function requestReport(baseUrl: string, input: ReportRange): Promise<Outcome<ReportRange>> {
  return createClient(baseUrl).requestReport(input);
}
