import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const narrateText = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ text: z.string().min(1).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const { synthesize } = await import("../services/voice.server");
    return synthesize(data.text);
  });

/** Lets the settings modal disable narration when no ElevenLabs key is configured. */
export const voiceStatus = createServerFn({ method: "GET" }).handler(async () => ({ available: Boolean(process.env["ELEVENLABS_API_KEY"]) }));
