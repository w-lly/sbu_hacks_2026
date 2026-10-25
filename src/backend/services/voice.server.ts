/** ElevenLabs narration. Server-only; returns null when no key is configured. */
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George – fits the Chief Engineer

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function synthesize(text: string): Promise<{ audio: string | null; error?: string }> {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) return { audio: null, error: "missing_key" };
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.55, similarity_boost: 0.75 } }),
    });
    if (!res.ok) {
      console.error("ElevenLabs error", res.status, await res.text().catch(() => ""));
      return { audio: null, error: `status_${res.status}` };
    }
    return { audio: toBase64(await res.arrayBuffer()) };
  } catch (err) {
    console.error("ElevenLabs call failed", err);
    return { audio: null, error: "network" };
  }
}
