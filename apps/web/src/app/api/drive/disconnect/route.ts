import { disconnectDrive } from "@bolo/core";
import { handle } from "@/lib/api-route";

export async function POST() {
  return handle(async () => {
    disconnectDrive();
    return { ok: true };
  }, { admin: true });
}
