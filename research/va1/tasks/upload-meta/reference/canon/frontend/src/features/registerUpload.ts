import { createClient } from "../canon/client";
import type { UploadMeta } from "../canon/types";
import type { Outcome } from "./result";

/** Register an upload. */
export async function registerUpload(baseUrl: string, input: UploadMeta): Promise<Outcome<UploadMeta>> {
  return createClient(baseUrl).registerUpload(input);
}
