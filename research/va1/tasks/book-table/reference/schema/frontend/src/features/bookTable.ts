import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type TableBooking = components["schemas"]["TableBooking"];

/** Book a table. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function bookTable(baseUrl: string, input: TableBooking): Promise<Outcome<TableBooking>> {
  return send(baseUrl, "POST", "/tables/book", "TableBooking", input);
}
