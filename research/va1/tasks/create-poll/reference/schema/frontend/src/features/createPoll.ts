import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type Poll = components["schemas"]["Poll"];

/** Create a poll. Every rule is in the Pydantic model, so the generated validator carries all of it. */
export async function createPoll(baseUrl: string, input: Poll): Promise<Outcome<Poll>> {
  return send(baseUrl, "POST", "/polls", "Poll", input);
}
