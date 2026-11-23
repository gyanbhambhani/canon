import { createClient } from "../canon/client";
import type { SeatBlock } from "../canon/types";
import type { Outcome } from "./result";

/** Reserve seats. */
export async function reserveSeats(baseUrl: string, input: SeatBlock): Promise<Outcome<SeatBlock>> {
  return createClient(baseUrl).reserveSeats(input);
}
