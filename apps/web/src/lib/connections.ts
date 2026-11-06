import "server-only";
import { claudeAvailable, connectionStatus, setting } from "@bolo/core";

/** Which AI writes for a company, for labels ("Claude", "OpenAI") — null when none is connected. */
export function aiLabel(companyId: string): string | null {
  const ai = connectionStatus(companyId).ai;
  if (ai.connected) return ai.provider === "openai" ? "OpenAI" : "Claude";
  if (setting("BOLO_LOCAL_CLAUDE") !== "off" && claudeAvailable()) return "Claude";
  return null;
}
