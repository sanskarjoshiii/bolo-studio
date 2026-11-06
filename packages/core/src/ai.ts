import Anthropic from "@anthropic-ai/sdk";
import { setting } from "./env";
import { WorkflowError } from "./errors";
import { decrypt } from "./secrets";
import { readStore } from "./store";

// The AI that writes and designs for a company: the company's own key (Claude or OpenAI), else —
// on the agency's own machine only — the local Claude Code login. Every call returns JSON that
// matches a schema, and can be cancelled.

export type AiProvider = "anthropic" | "openai";
export const AI_PROVIDERS: { id: AiProvider; label: string; defaultModel: string; keyHint: string; keyUrl: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)", defaultModel: "claude-opus-5-5", keyHint: "sk-ant-…", keyUrl: "https://platform.claude.com/settings/keys" },
  { id: "openai", label: "OpenAI (ChatGPT / Codex)", defaultModel: "gpt-5", keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys" },
];

export type AiRequest = { system: string; prompt: string; schema: Record<string, unknown>; signal?: AbortSignal; timeoutMs?: number };

/** Which AI runs for this company — null when nothing is connected. */
export function aiFor(companyId: string): { provider: AiProvider | "claude-code"; model?: string; key?: string } | null {
  const ai = readStore().companies.find((c) => c.id === companyId)?.connections.ai;
  if (ai) return { provider: ai.provider, model: ai.model, key: decrypt(ai.key) };
  return null;
}

/**
 * JSON-schema features the structured-output endpoints don't accept (array length limits): the
 * answer is validated and trimmed by the caller anyway, so they're dropped from the request.
 */
export function relaxSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(relaxSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "minItems" || k === "maxItems") continue;
    out[k] = relaxSchema(v);
  }
  return out;
}

const cancelled = () => new WorkflowError(409, "Cancelled.");

/** Claude through the Anthropic API with the company's key. */
async function viaAnthropic(key: string, model: string, req: AiRequest): Promise<unknown> {
  const client = new Anthropic({ apiKey: key, timeout: req.timeoutMs ?? 180_000, maxRetries: 2 });
  try {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: 16000,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
        output_config: { effort: "medium", format: { type: "json_schema", schema: relaxSchema(req.schema) as Record<string, unknown> } },
        // A safety decline re-runs on the server's recommended fallback model instead of failing
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: req.signal },
    );
    if (response.stop_reason === "refusal") throw new WorkflowError(409, "Claude declined to write this one — rephrase the idea and try again.");
    if (response.stop_reason === "max_tokens") throw new WorkflowError(409, "Claude's answer was cut off — try a shorter idea.");
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return JSON.parse(text);
  } catch (e) {
    if (req.signal?.aborted || e instanceof Anthropic.APIUserAbortError) throw cancelled();
    if (e instanceof WorkflowError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new WorkflowError(409, "The Claude API key was rejected — update it in Connections → AI agent.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new WorkflowError(409, "This Claude API key can't use that model — check the key's workspace in the Claude Console.");
    if (e instanceof Anthropic.RateLimitError) throw new WorkflowError(409, "Claude is rate-limited for this key right now — try again in a minute.");
    if (e instanceof Anthropic.BadRequestError) throw new WorkflowError(409, `Claude rejected the request: ${e.message.slice(0, 200)}`);
    if (e instanceof Anthropic.APIConnectionError) throw new WorkflowError(409, "Couldn't reach the Claude API — check the server's internet connection.");
    if (e instanceof Anthropic.APIError) throw new WorkflowError(409, `Claude API error ${e.status ?? ""}: ${e.message.slice(0, 200)}`);
    if (e instanceof SyntaxError) throw new WorkflowError(409, "Claude's answer wasn't valid JSON — try again.");
    throw e;
  }
}

/** OpenAI Chat Completions with a strict JSON schema, using the company's key. */
async function viaOpenAI(key: string, model: string, req: AiRequest): Promise<unknown> {
  const timeout = AbortSignal.timeout(req.timeoutMs ?? 180_000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
        response_format: { type: "json_schema", json_schema: { name: "post", strict: true, schema: relaxSchema(req.schema) } },
      }),
    });
  } catch (e) {
    if (req.signal?.aborted) throw cancelled();
    if ((e as Error).name === "TimeoutError") throw new WorkflowError(409, "OpenAI took too long — try again.");
    throw new WorkflowError(409, "Couldn't reach OpenAI — check the server's internet connection.");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string; refusal?: string } }[] };
  if (res.status === 401) throw new WorkflowError(409, "The OpenAI API key was rejected — update it in Connections → AI agent.");
  if (res.status === 429) throw new WorkflowError(409, "OpenAI is rate-limited or out of credit for this key.");
  if (!res.ok) throw new WorkflowError(409, `OpenAI error ${res.status}: ${(body.error?.message ?? "").slice(0, 200)}`);
  const msg = body.choices?.[0]?.message;
  if (msg?.refusal) throw new WorkflowError(409, "OpenAI declined to write this one — rephrase the idea.");
  try {
    return JSON.parse(msg?.content ?? "");
  } catch {
    throw new WorkflowError(409, "OpenAI's answer wasn't valid JSON — try again.");
  }
}

/** Test a key before saving it: one tiny request. */
export async function checkAiKey(provider: AiProvider, key: string, model?: string) {
  const req: AiRequest = {
    system: "Reply with the JSON object only.",
    prompt: 'Return {"ok": true}.',
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    timeoutMs: 45_000,
  };
  const m = model || AI_PROVIDERS.find((p) => p.id === provider)!.defaultModel;
  await (provider === "anthropic" ? viaAnthropic(key, m, req) : viaOpenAI(key, m, req));
}

/**
 * Run the company's AI. Falls back to the local Claude Code CLI (passed in by claude.ts, which owns
 * it) only when the company hasn't connected one and this server allows it.
 */
export async function runAI(companyId: string, req: AiRequest, localFallback: (req: AiRequest) => Promise<unknown>): Promise<{ result: unknown; provider: string }> {
  const ai = aiFor(companyId);
  if (ai?.provider === "anthropic") return { result: await viaAnthropic(ai.key!, ai.model || "claude-opus-5-5", req), provider: "Claude" };
  if (ai?.provider === "openai") return { result: await viaOpenAI(ai.key!, ai.model || "gpt-5", req), provider: "OpenAI" };
  if (setting("BOLO_LOCAL_CLAUDE") !== "off") return { result: await localFallback(req), provider: "Claude" };
  throw new WorkflowError(409, "Connect an AI agent first — Connections → AI agent (Claude or OpenAI API key).");
}
