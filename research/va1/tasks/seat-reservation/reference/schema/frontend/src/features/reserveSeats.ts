import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type SeatBlock = components["schemas"]["SeatBlock"];

/** Reserve seats. The schema carries the three ranges; the fit rule is written here too. */
export async function reserveSeats(baseUrl: string, input: SeatBlock): Promise<Outcome<SeatBlock>> {
  return send(baseUrl, "POST", "/seats/reserve", "SeatBlock", input, (i: SeatBlock) => (i.first_seat + i.seats - 1 > 20 ? "the seats must fit in the row" : null));
}
