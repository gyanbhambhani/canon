import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Shipment = components["schemas"]["Shipment"];

/** Create a shipment. The schema carries the range rules; the size limit is written here too. */
export async function createShipment(baseUrl: string, input: Shipment): Promise<Outcome<Shipment>> {
  return send(baseUrl, "POST", "/shipments", "Shipment", input, (i: Shipment) => {
    if (i.length + 2 * (i.width + i.height) > 300) return "length + 2 * (width + height) must be at most 300";
    return null;
  });
}
