import { createClient } from "../canon/client";
import type { TableBooking } from "../canon/types";
import type { Outcome } from "./result";

/** Book a table. */
export async function bookTable(baseUrl: string, input: TableBooking): Promise<Outcome<TableBooking>> {
  return createClient(baseUrl).bookTable(input);
}
