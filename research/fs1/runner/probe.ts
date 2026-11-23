/** Exit 0 if claude-opus-5-5 answers a one-token request, 1 if the account has no credit, 2 otherwise. */
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "./models";

loadEnv();
try {
  await new Anthropic({ maxRetries: 1 }).messages.create({ model: "claude-opus-5-5", max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] });
  console.log("available");
  process.exit(0);
} catch (e) {
  const m = e instanceof Error ? e.message : String(e);
  console.log(/credit balance is too low/i.test(m) ? "no credit" : `error: ${m.slice(0, 200)}`);
  process.exit(/credit balance is too low/i.test(m) ? 1 : 2);
}
