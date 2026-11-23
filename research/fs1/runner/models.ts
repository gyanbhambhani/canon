/**
 * FS-1's models: a local MLX model (OpenAI-compatible mlx_lm.server), Claude through the Anthropic
 * SDK, and GPT through the OpenAI SDK. Keys come from the repository's .env.local, never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ROOT } from "../harness/arms";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Model {
  id: string;
  /** USD per million tokens, or null where no list price is known (dollars are then null). */
  price: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
  chat(system: string, turns: Turn[]): Promise<{ text: string; usage: Usage }>;
}

export function loadEnv() {
  const f = join(ROOT, ".env.local");
  if (!existsSync(f)) return;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

/** A local MLX model behind mlx_lm.server (temperature 0.2, as CanonBench fixes for primary runs). */
export function localModel(name: string, port: number): Model {
  const client = new OpenAI({ baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "local", maxRetries: 3, timeout: 900_000 });
  return {
    id: name,
    price: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    async chat(system, turns) {
      const res = await client.chat.completions.create({
        model: `mlx-community/${name}`,
        messages: [{ role: "system", content: system }, ...turns],
        temperature: 0.2,
        max_tokens: 6000,
      });
      return {
        text: res.choices[0]?.message?.content ?? "",
        usage: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0, cacheRead: 0, cacheWrite: 0 },
      };
    },
  };
}

/**
 * Claude Opus 5.5: list prices $4 / $20 per million input / output tokens, cache reads $0.20 (cache
 * writes at 1.25 × input, $5), from the Claude API reference, 2026-11. Effort medium (the model's
 * default); no temperature, which the model rejects. Refusals fall back server-side.
 */
export function claudeModel(model: string): Model {
  const client = new Anthropic({ maxRetries: 8 });
  return {
    id: model,
    price: model === "claude-opus-5-5" ? { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } : null,
    async chat(system, turns) {
      const res = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default" as const,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: turns,
      });
      if (res.stop_reason === "refusal") throw new Error(`refusal: ${JSON.stringify(res.stop_details)}`);
      return {
        text: res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(""),
        usage: {
          input: res.usage.input_tokens,
          output: res.usage.output_tokens,
          cacheRead: res.usage.cache_read_input_tokens ?? 0,
          cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
        },
      };
    },
  };
}

/** A GPT model. Prices from FS1_PRICE_GPT_IN / FS1_PRICE_GPT_OUT (USD per million), else unknown. */
export function gptModel(model: string): Model {
  const client = new OpenAI({ maxRetries: 8, timeout: 900_000 });
  const pin = Number(process.env.FS1_PRICE_GPT_IN);
  const pout = Number(process.env.FS1_PRICE_GPT_OUT);
  return {
    id: model,
    price: pin > 0 && pout > 0 ? { input: pin, output: pout, cacheRead: pin, cacheWrite: pin } : null,
    async chat(system, turns) {
      const res = await client.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, ...turns],
        max_completion_tokens: 16000,
      });
      const cached = (res.usage as { prompt_tokens_details?: { cached_tokens?: number } } | undefined)?.prompt_tokens_details?.cached_tokens ?? 0;
      return {
        text: res.choices[0]?.message?.content ?? "",
        usage: { input: (res.usage?.prompt_tokens ?? 0) - cached, output: res.usage?.completion_tokens ?? 0, cacheRead: cached, cacheWrite: 0 },
      };
    },
  };
}

export function dollars(model: Model, u: Usage): number | null {
  if (!model.price) return null;
  const p = model.price;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite) / 1e6;
}

/** The OpenAI models whose id mentions a name (used to find GPT-6.2 Sol's exact id). */
export async function findOpenAIModels(fragment: RegExp): Promise<string[]> {
  const client = new OpenAI();
  const out: string[] = [];
  for await (const m of client.models.list()) if (fragment.test(m.id)) out.push(m.id);
  return out.sort();
}
