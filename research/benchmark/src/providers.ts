/**
 * Model adapters with one interface: send a system prompt plus a conversation, get text back
 * with token usage. Each uses its provider's official SDK.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Usage {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
}

export interface Reply {
  text: string;
  usage: Usage;
  /** The model that actually produced the reply (differs from the requested one after a fallback). */
  servedBy: string;
  fallback: boolean;
}

export interface Provider {
  id: string;
  model: string;
  chat(system: string, turns: Turn[]): Promise<Reply>;
}

export function anthropicProvider(model = "claude-opus-5-5"): Provider {
  const client = new Anthropic({ maxRetries: 8 });
  return {
    id: "anthropic",
    model,
    async chat(system, turns) {
      // Refusal fallbacks are on (Anthropic's recommended default); runs served by a fallback
      // model are recorded and excluded from the benchmark metrics.
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: turns.map((t) => ({ role: t.role, content: t.content })),
      });
      if (res.stop_reason === "refusal") throw new Error(`refusal: ${JSON.stringify(res.stop_details)}`);
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      const fallback = (res.usage.iterations ?? []).some((it) => it.type === "fallback_message");
      return {
        text,
        usage: {
          input: res.usage.input_tokens,
          cachedInput: res.usage.cache_read_input_tokens ?? 0,
          cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
          output: res.usage.output_tokens,
        },
        servedBy: res.model,
        fallback,
      };
    },
  };
}

export function openaiProvider(model = "gpt-6.2-sol"): Provider {
  const client = new OpenAI({ maxRetries: 8 });
  return {
    id: "openai",
    model,
    async chat(system, turns) {
      const res = await client.responses.create({
        model,
        instructions: system,
        input: turns.map((t) => ({ role: t.role, content: t.content })),
      });
      const cached = res.usage?.input_tokens_details?.cached_tokens ?? 0;
      return {
        text: res.output_text,
        usage: {
          input: (res.usage?.input_tokens ?? 0) - cached,
          cachedInput: cached,
          cacheWrite: 0,
          output: res.usage?.output_tokens ?? 0,
        },
        servedBy: res.model ?? model,
        fallback: false,
      };
    },
  };
}
