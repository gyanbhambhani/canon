import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type ReportRange = components["schemas"]["ReportRange"];

/** Request a range report. The schema carries the ranges and the enum; the two rules over several fields are written here too. */
export async function requestReport(baseUrl: string, input: ReportRange): Promise<Outcome<ReportRange>> {
  return send(baseUrl, "POST", "/reports/range", "ReportRange", input, (i: ReportRange) => {
    if (i.to_day < i.from_day) return "to_day must not be before from_day";
    if (i.to_day - i.from_day > 14 && i.granularity !== "week") return "a range wider than 14 days must be week";
    return null;
  });
}
