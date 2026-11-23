import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type UploadMeta = components["schemas"]["UploadMeta"];

/** Register an upload. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function registerUpload(baseUrl: string, input: UploadMeta): Promise<Outcome<UploadMeta>> {
  return send(baseUrl, "POST", "/uploads", "UploadMeta", input);
}
