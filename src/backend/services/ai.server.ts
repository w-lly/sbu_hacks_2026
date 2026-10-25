/** Thin wrapper around AI providers. Server-only. Uses Google Gemini when GEMINI_API_KEY is set, otherwise the Lovable AI Gateway. */
import { generateResponse, GatewayError } from "@lovable.dev/ai-gateway";

export const AI_MODEL = "openai/gpt-6-astra" as const;
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function extractText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output as { type?: string; content?: { type?: string; text?: string }[] }[]) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const c of item.content) if (c.type === "output_text" && typeof c.text === "string") parts.push(c.text);
  }
  return parts.join("");
}

function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Ask Gemini for a JSON object. Returns null on any failure so callers can fall back to the Lovable gateway. */
async function askGemini(system: string, user: string, apiKey: string): Promise<string | null> {
  try {
    const model = process.env["GEMINI_MODEL"] || GEMINI_DEFAULT_MODEL;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system + "\nRespond with a single JSON object and nothing else." }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return text || null;
  } catch (err) {
    console.error("Gemini call failed", err);
    return null;
  }
}

/** Ask the model for a JSON object. Returns null on any failure so callers can fall back. */
export async function askJson<T>(system: string, user: string): Promise<T | null> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    const text = await askGemini(system, user, geminiKey);
    const parsed = text ? parseJson<T>(text) : null;
    if (parsed) return parsed;
    console.error("Gemini returned no usable JSON; falling back to Lovable AI Gateway");
  }
  try {
    const res = await generateResponse({
      model: AI_MODEL,
      instructions: system + "\nRespond with a single JSON object and nothing else.",
      input: user,
    });
    return parseJson<T>(extractText((res as { output?: unknown }).output));
  } catch (err) {
    if (err instanceof GatewayError) console.error("AI gateway error", err.code, err.httpStatus, err.ids);
    else console.error("AI call failed", err);
    return null;
  }
}
