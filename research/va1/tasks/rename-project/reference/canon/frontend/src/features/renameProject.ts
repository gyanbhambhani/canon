import { createClient } from "../canon/client";
import type { ProjectRename } from "../canon/types";
import type { Outcome } from "./result";

/** Rename a project. */
export async function renameProject(baseUrl: string, input: ProjectRename): Promise<Outcome<ProjectRename>> {
  return createClient(baseUrl).renameProject(input);
}
