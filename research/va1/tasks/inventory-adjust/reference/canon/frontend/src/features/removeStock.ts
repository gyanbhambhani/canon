import { createClient } from "../canon/client";
import type { StockRemoval, StockResult } from "../canon/types";
import type { Outcome } from "./result";

/** Remove stock. */
export async function removeStock(baseUrl: string, input: StockRemoval): Promise<Outcome<StockResult>> {
  return createClient(baseUrl).removeStock(input);
}
