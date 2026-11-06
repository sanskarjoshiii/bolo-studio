import { NextResponse } from "next/server";
import { refreshStore, handleTelegramUpdate, setting, type TgUpdate } from "@bolo/core";

/**
 * Telegram → Bolo (production). Register once with setWebhook and secret_token =
 * TELEGRAM_WEBHOOK_SECRET (docs/deploy-aws.md); every call must carry that secret.
 */
export async function POST(req: Request) {
  await refreshStore();
  const secret = setting("TELEGRAM_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) return NextResponse.json({ error: "Bad secret" }, { status: 401 });
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update) await handleTelegramUpdate(update).catch((e) => console.error("telegram update:", (e as Error).message));
  return NextResponse.json({ ok: true });
}
