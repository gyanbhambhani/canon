/** Exit 0 if a minimal claude-opus-5-5 call succeeds (used to resume after the credit ran out). */
import Anthropic from "@anthropic-ai/sdk";
import { loadEnv } from "../runner/env.js";

loadEnv();
try {
  await new Anthropic({ maxRetries: 0 }).messages.create({ model: "claude-opus-5-5", max_tokens: 16, messages: [{ role: "user", content: "Reply with: ok" }] });
  console.log("opus available");
  process.exit(0);
} catch (e) {
  console.log(`opus unavailable: ${String((e as Error).message).slice(0, 120)}`);
  process.exit(1);
}
