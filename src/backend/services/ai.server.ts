/** Direct Gemini integration. Server-only; callers retain cached/rule-based fallbacks. */
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

function parseJson<T>(text: string): T | null {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Returns null on failure so reports remain available without an AI service. */
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
  if (!geminiKey) return null;
  const text = await askGemini(system, user, geminiKey);
  return text ? parseJson<T>(text) : null;
}
