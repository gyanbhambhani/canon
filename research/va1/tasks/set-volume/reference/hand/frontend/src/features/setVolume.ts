import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface VolumeSetting {
  level: number;
}


/** Set the volume. */
export async function setVolume(baseUrl: string, input: VolumeSetting): Promise<Outcome<VolumeSetting>> {
  if (!Number.isInteger(input.level) || input.level < 0 || input.level > 100) return invalid("level must be from 0 to 100");
  return call(baseUrl, "POST", "/volume", input);
}
