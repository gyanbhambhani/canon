import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type ProjectRename = components["schemas"]["ProjectRename"];

/** Rename a project. The only rule is in the Pydantic model. */
export async function renameProject(baseUrl: string, input: ProjectRename): Promise<Outcome<ProjectRename>> {
  return send(baseUrl, "POST", "/projects/rename", "ProjectRename", input);
}
