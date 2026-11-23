/**
 * The three models, behind one chat interface, with a dollar ledger for the API models.
 *   qwen7b  Qwen2.5-Coder-7B-Instruct (MLX, 8-bit) behind mlx_lm.server; temperature 0.2, top_p 1.0
 *   opus    claude-opus-5-5 through the Anthropic SDK; adaptive thinking at effort "medium"
 *           (temperature cannot be set on this model)
 *   gpt     gpt-6.2-sol through the OpenAI SDK; reasoning_effort "medium" (temperature cannot be set)
 * List prices (USD per million tokens), looked up 2026-11-22:
 *   claude-opus-5-5: input 4.00, output 20.00, cache read 0.20, cache write (5 min) 5.00
 *   gpt-6.2-sol:     input 2.00, output 10.00, cached input 0.10
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { BENCH } from "../lib/seed.js";
import { loadEnv } from "./env.js";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
}
export interface Reply {
  text: string;
  usage: Usage;
}
export interface Model {
  key: string;
  id: string;
  api: boolean;
  chat(system: string, turns: Turn[], maxTokens?: number): Promise<Reply>;
}

export const CAP_USD: Record<string, number> = { opus: 150, gpt: 150 };
export const TOTAL_CAP_USD = 300;

type Entry = { usd: number; calls: number; input: number; output: number };
const ledgerFile = (key: string) => join(BENCH, "results", `spend-${key}.json`);
export function ledger(key: string): Entry {
  return existsSync(ledgerFile(key)) ? JSON.parse(readFileSync(ledgerFile(key), "utf8")) : { usd: 0, calls: 0, input: 0, output: 0 };
}
function charge(key: string, u: Usage) {
  const e = ledger(key);
  e.usd += u.usd;
  e.calls++;
  e.input += u.input + u.cacheRead + u.cacheWrite;
  e.output += u.output;
  writeFileSync(ledgerFile(key), JSON.stringify(e, null, 1) + "\n");
}
export class CapReached extends Error {}
export function checkCap(key: string) {
  const total = Object.keys(CAP_USD).reduce((a, k) => a + ledger(k).usd, 0);
  if (ledger(key).usd >= CAP_USD[key]) throw new CapReached(`${key} reached its USD ${CAP_USD[key]} cap`);
  if (total >= TOTAL_CAP_USD) throw new CapReached(`total USD ${TOTAL_CAP_USD} cap reached`);
}

function qwen(port: number, name = "Qwen2.5-Coder-7B-Instruct-8bit"): Model {
  const client = new OpenAI({ baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "local", maxRetries: 3, timeout: 900_000 });
  return {
    key: "qwen7b",
    id: `mlx-community/${name}`,
    api: false,
    async chat(system, turns, maxTokens = 2048) {
      const res = await client.chat.completions.create({
        model: `mlx-community/${name}`,
        messages: [{ role: "system", content: system }, ...turns],
        temperature: 0.2,
        max_tokens: maxTokens,
      });
      return {
        text: res.choices[0]?.message?.content ?? "",
        usage: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0, cacheRead: 0, cacheWrite: 0, usd: 0 },
      };
    },
  };
}

function opus(): Model {
  const client = new Anthropic({ maxRetries: 8, timeout: 900_000 });
  return {
    key: "opus",
    id: "claude-opus-5-5",
    api: true,
    async chat(system, turns, maxTokens = 16000) {
      checkCap("opus");
      const res = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: turns,
      } as never);
      const r = res as unknown as {
        stop_reason: string;
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      };
      const u = r.usage;
      const usage: Usage = {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheRead: u.cache_read_input_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        usd: 0,
      };
      usage.usd = (usage.input * 4 + usage.output * 20 + usage.cacheRead * 0.2 + usage.cacheWrite * 5) / 1e6;
      charge("opus", usage);
      if (r.stop_reason === "refusal") throw new Error("refusal");
      return { text: r.content.flatMap((b) => (b.type === "text" ? [b.text ?? ""] : [])).join(""), usage };
    },
  };
}

function gpt(): Model {
  const client = new OpenAI({ maxRetries: 8, timeout: 900_000 });
  return {
    key: "gpt",
    id: "gpt-6.2-sol",
    api: true,
    async chat(system, turns, maxTokens = 16000) {
      checkCap("gpt");
      const res = (await client.chat.completions.create({
        model: "gpt-6.2-sol",
        messages: [{ role: "system", content: system }, ...turns],
        reasoning_effort: "medium",
        max_completion_tokens: maxTokens,
      } as never)) as unknown as OpenAI.Chat.Completions.ChatCompletion;
      const cached = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const usage: Usage = {
        input: (res.usage?.prompt_tokens ?? 0) - cached,
        output: res.usage?.completion_tokens ?? 0,
        cacheRead: cached,
        cacheWrite: 0,
        usd: 0,
      };
      usage.usd = (usage.input * 2 + usage.output * 10 + usage.cacheRead * 0.1) / 1e6;
      charge("gpt", usage);
      return { text: res.choices[0]?.message?.content ?? "", usage };
    },
  };
}

export function makeModel(key: string, port = 8091): Model {
  loadEnv();
  if (key === "qwen7b") return qwen(port);
  if (key === "opus") return opus();
  if (key === "gpt") return gpt();
  throw new Error(`unknown model ${key}`);
}
