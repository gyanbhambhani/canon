/** Lists the model IDs available to the API keys (IDs only; keys are never printed). */
import { loadEnv } from "./env.js";

loadEnv();
const o = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
const oj = (await o.json()) as { data?: { id: string }[]; error?: { message: string } };
console.log("openai", o.status, (oj.data ?? []).map((m) => m.id).sort().join(" "), oj.error?.message ?? "");
const a = await fetch("https://api.anthropic.com/v1/models?limit=100", {
  headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
});
const aj = (await a.json()) as { data?: { id: string }[]; error?: { message: string } };
console.log("anthropic", a.status, (aj.data ?? []).map((m) => m.id).join(" "), aj.error?.message ?? "");
