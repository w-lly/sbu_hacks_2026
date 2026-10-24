/** Thin wrapper around the Lovable AI Gateway. Server-only. */
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

export const AI_MODEL = "openai/gpt-6-astra" as const;

function extractText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output as { type?: string; content?: { type?: string; text?: string }[] }[]) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) if (c.type === "output_text" && typeof c.text === "string") parts.push(c.text);
  }
  return parts.join("");
}

/** Ask the model for a JSON object. Returns null on any failure so callers can fall back. */
export async function askJson<T>(system: string, user: string): Promise<T | null> {
  try {
    const res = await generateResponse({
      model: AI_MODEL,
      instructions: system + "\nRespond with a single JSON object and nothing else.",
      input: user,
    });
    const text = extractText((res as { output?: unknown }).output);
    const start = text.indexOf("{"), end = text.lastIndexOf("}");
    if (start < 0 || end < start) return null;
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch (err) {
    if (err instanceof GatewayError) console.error("AI gateway error", err.code, err.httpStatus, err.ids);
    else console.error("AI call failed", err);
    return null;
  }
}
