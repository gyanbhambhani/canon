import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Setting = components["schemas"]["Setting"];

/** Set the thermostat. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function setThermostat(baseUrl: string, input: Setting): Promise<Outcome<Setting>> {
  return send(baseUrl, "POST", "/thermostat", "Setting", input);
}
