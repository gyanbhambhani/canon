import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface SeatBlock {
  seats: number;
  row: number;
  first_seat: number;
}


/** Reserve seats. */
export async function reserveSeats(baseUrl: string, input: SeatBlock): Promise<Outcome<SeatBlock>> {
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > 10) return invalid("seats must be from 1 to 10");
  if (!Number.isInteger(input.row) || input.row < 1 || input.row > 30) return invalid("row must be from 1 to 30");
  if (!Number.isInteger(input.first_seat) || input.first_seat < 1 || input.first_seat > 20) return invalid("first_seat must be from 1 to 20");
  if (input.first_seat + input.seats - 1 > 20) return invalid("the seats must fit in the row");
  return call(baseUrl, "POST", "/seats/reserve", input);
}
