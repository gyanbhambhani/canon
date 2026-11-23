import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type VolumeSetting = components["schemas"]["VolumeSetting"];

/** Set the volume. The only rule is in the Pydantic model. */
export async function setVolume(baseUrl: string, input: VolumeSetting): Promise<Outcome<VolumeSetting>> {
  return send(baseUrl, "POST", "/volume", "VolumeSetting", input);
}
