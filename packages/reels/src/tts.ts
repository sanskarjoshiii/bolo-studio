import { sarvamKey, WorkflowError } from "@bolo/core";

// Sarvam AI text-to-speech — https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert
// Indian-language voices (Marathi, Hindi, English and code-mixed text) for reel voiceovers.

export const SARVAM_LANGS = ["bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"];

/** Voiceover is available: the company's own Sarvam key, or the platform's. */
export function ttsConfigured(companyId?: string) {
  return Boolean(sarvamKey(companyId));
}

/** One voice clip as WAV bytes. */
export async function speak(text: string, opts: { lang: string; speaker?: string; companyId?: string }) {
  const key = sarvamKey(opts.companyId);
  if (!key) throw new WorkflowError(409, "Sarvam AI isn't connected — Connections → Sarvam AI, or render the reel without voice.");
  if (!SARVAM_LANGS.includes(opts.lang)) throw new WorkflowError(400, `Voice language must be one of ${SARVAM_LANGS.join(", ")}.`);

  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      language_code: opts.lang,
      model: "bulbul:v3",
      speaker: opts.speaker ?? "priya",
      speech_sample_rate: 24000,
      output_audio_codec: "wav",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { audios?: string[]; error?: { message?: string } };
  if (!res.ok || !body.audios?.[0]) {
    throw new WorkflowError(409, `Sarvam voiceover failed (${res.status}): ${body.error?.message ?? "no audio returned"}`);
  }
  return Buffer.from(body.audios[0], "base64");
}

/** Duration of a PCM WAV in seconds, from its header (fmt byte rate + data chunk size). */
export function wavSeconds(wav: Buffer) {
  let byteRate = 0;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "fmt ") byteRate = wav.readUInt32LE(offset + 16);
    if (id === "data" && byteRate) return Math.min(size, wav.length - offset - 8) / byteRate;
    offset += 8 + size + (size % 2);
  }
  throw new Error("Not a readable WAV file");
}
