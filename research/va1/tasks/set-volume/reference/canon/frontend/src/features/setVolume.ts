import { createClient } from "../canon/client";
import type { VolumeSetting } from "../canon/types";
import type { Outcome } from "./result";

/** Set the volume. */
export async function setVolume(baseUrl: string, input: VolumeSetting): Promise<Outcome<VolumeSetting>> {
  return createClient(baseUrl).setVolume(input);
}
