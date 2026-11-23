import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface UploadMeta {
  filename: string;
  size_kb: number;
  kind: string;
}

const KINDS = ["png", "jpg", "pdf"];

/** Register an upload. */
export async function registerUpload(baseUrl: string, input: UploadMeta): Promise<Outcome<UploadMeta>> {
  const length = [...input.filename].length;
  if (length < 1 || length > 100) return invalid("filename must have 1 to 100 characters");
  if (!Number.isInteger(input.size_kb) || input.size_kb < 1 || input.size_kb > 10240) return invalid("size_kb must be from 1 to 10240");
  if (!KINDS.includes(input.kind)) return invalid("kind must be png, jpg or pdf");
  return call(baseUrl, "POST", "/uploads", input);
}
