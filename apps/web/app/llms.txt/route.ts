import { agentReference } from "@/lib/agent-reference";

export const dynamic = "force-static";

/** The complete language reference for agents, as plain text (same text as /docs/for-agents). */
export function GET() {
  return new Response(agentReference(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
