// Runs once when the server starts, before it takes requests: load the store (instant with the JSON
// files; MongoDB when MONGODB_URI is set), then start the background work that runs without anyone
// on a page — publishing approved posts at their time, and listening to the Telegram bot.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { loadStore, startScheduler, startTelegramPoller } = await import("@bolo/core");
  await loadStore();
  if (process.env.BOLO_BACKGROUND === "off") return;
  startScheduler();
  startTelegramPoller();
}
