/**
 * VA-1's models. Only a local MLX model (OpenAI-compatible mlx_lm.server, started and owned by the
 * CanonBench agent, never by VA-1) is used: the Anthropic and OpenAI accounts are out of credit
 * (Amendment 1 in PREREGISTRATION.md). A paid-model call that fails for credit is an infrastructure
 * failure and records nothing. Keys are never read here.
 */
import OpenAI from "openai";

export interface Usage {
  input: number;
  output: number;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Model {
  id: string;
  chat(system: string, turns: Turn[]): Promise<{ text: string; usage: Usage }>;
}

/** A local MLX model behind mlx_lm.server (temperature 0.2, as FS-1 and CanonBench fix it). */
export function localModel(name: string, port: number): Model {
  const client = new OpenAI({ baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "local", maxRetries: 3, timeout: 900_000 });
  return {
    id: name,
    async chat(system, turns) {
      const res = await client.chat.completions.create({
        model: `mlx-community/${name}`,
        messages: [{ role: "system", content: system }, ...turns],
        temperature: 0.2,
        max_tokens: 6000,
      });
      return {
        text: res.choices[0]?.message?.content ?? "",
        usage: { input: res.usage?.prompt_tokens ?? 0, output: res.usage?.completion_tokens ?? 0 },
      };
    },
  };
}
