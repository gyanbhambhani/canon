import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface ReportRange {
  from_day: number;
  to_day: number;
  granularity: string;
}

const GRANULARITIES = ["day", "week"];

/** Request a range report. */
export async function requestReport(baseUrl: string, input: ReportRange): Promise<Outcome<ReportRange>> {
  if (!Number.isInteger(input.from_day) || input.from_day < 1 || input.from_day > 31) return invalid("from_day must be from 1 to 31");
  if (!Number.isInteger(input.to_day) || input.to_day < 1 || input.to_day > 31) return invalid("to_day must be from 1 to 31");
  if (!GRANULARITIES.includes(input.granularity)) return invalid("granularity must be day or week");
  if (input.to_day < input.from_day) return invalid("to_day must not be before from_day");
  if (input.to_day - input.from_day > 14 && input.granularity !== "week") return invalid("a range wider than 14 days must be week");
  return call(baseUrl, "POST", "/reports/range", input);
}
