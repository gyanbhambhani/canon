import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface TableBooking {
  party_size: number;
  name: string;
}

/** Book a table. */
export async function bookTable(baseUrl: string, input: TableBooking): Promise<Outcome<TableBooking>> {
  if (input.party_size < 1 || input.party_size > 12) return invalid("party_size must be from 1 to 12");
  if (/^[ \t\r\n]*$/.test(input.name) || [...input.name].length > 40) return invalid("name must be present and at most 40 characters");
  return call(baseUrl, "POST", "/tables/book", input);
}
