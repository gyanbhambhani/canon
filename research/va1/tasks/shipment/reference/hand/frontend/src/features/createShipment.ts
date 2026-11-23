import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface Shipment {
  weight_g: number;
  length: number;
  width: number;
  height: number;
}

/** Create a shipment. */
export async function createShipment(baseUrl: string, input: Shipment): Promise<Outcome<Shipment>> {
  if (input.weight_g < 1 || input.weight_g > 30000) return invalid("weight_g must be from 1 to 30000");
  if (input.length < 1 || input.length > 200) return invalid("length must be from 1 to 200");
  if (input.width < 1 || input.width > 100 || input.height < 1 || input.height > 100) {
    return invalid("width and height must be from 1 to 100");
  }
  if (input.length + 2 * (input.width + input.height) > 300) return invalid("length + 2 * (width + height) must be at most 300");
  return call(baseUrl, "POST", "/shipments", input);
}
