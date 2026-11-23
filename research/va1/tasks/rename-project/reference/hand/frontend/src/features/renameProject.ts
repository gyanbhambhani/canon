import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface ProjectRename {
  name: string;
}


/** Rename a project. */
export async function renameProject(baseUrl: string, input: ProjectRename): Promise<Outcome<ProjectRename>> {
  const length = [...input.name].length;
  if (length < 3 || length > 40) return invalid("name must have 3 to 40 characters");
  return call(baseUrl, "POST", "/projects/rename", input);
}
