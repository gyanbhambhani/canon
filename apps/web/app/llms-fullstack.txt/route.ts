import { agentReference } from "@/lib/agent-reference";

export const dynamic = "force-static";

/** v0.5: the full-stack addendum to the agent reference, as plain text (same text as /docs/for-agents-fullstack). */
export function GET() {
  return new Response(agentReference("fullstack"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
