import { createClient } from "../canon/client";
import type { Shipment } from "../canon/types";
import type { Outcome } from "./result";

/** Create a shipment. */
export async function createShipment(baseUrl: string, input: Shipment): Promise<Outcome<Shipment>> {
  return createClient(baseUrl).createShipment(input);
}
