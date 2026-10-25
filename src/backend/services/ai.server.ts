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
async function askGemini(system: string, user: string, apiKey: string, purpose: string): Promise<string | null> {
  const started = Date.now();
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
      console.error(`[gemini] ${purpose} failed: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    console.log(`[gemini] ${purpose} ${text ? "ok" : "empty response"} in ${Date.now() - started}ms`);
    return text || null;
  } catch {
    console.error(`[gemini] ${purpose} failed: network error`);
    return null;
  }
}

/** Ask the model for a JSON object. Returns null on any failure so callers can fall back. */
export async function askJson<T>(system: string, user: string, purpose = "request"): Promise<T | null> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (!geminiKey) {
    console.log(`[gemini] ${purpose} skipped: no API key`);
    return null;
  }
  const text = await askGemini(system, user, geminiKey, purpose);
  return text ? parseJson<T>(text) : null;
}

/** Lightweight reachability check for the HUD online/offline indicator. */
export async function checkGemini(): Promise<{ online: boolean }> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    console.log("[gemini] status check: offline (no API key)");
    return { online: false };
  }
  try {
    const model = process.env["GEMINI_MODEL"] || GEMINI_DEFAULT_MODEL;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(4000),
    });
    console.log(`[gemini] status check: ${res.ok ? "online" : `offline (HTTP ${res.status})`}`);
    return { online: res.ok };
  } catch {
    console.log("[gemini] status check: offline (network error)");
    return { online: false };
  }
}
