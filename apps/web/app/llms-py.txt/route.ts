import { agentReference } from "@/lib/agent-reference";

export const dynamic = "force-static";

/** The Canon-Py language reference for agents, as plain text (same text as /docs/for-agents-py). */
export function GET() {
  return new Response(agentReference("py"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
