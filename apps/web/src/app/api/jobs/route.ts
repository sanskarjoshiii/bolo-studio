import { activeJobs, clientsFor, unreadCount } from "@bolo/core";
import { handle } from "@/lib/api-route";
import { isRunning } from "@/lib/pipeline";

/**
 * What's being generated right now in my companies (the progress dock) and my unread
 * notification count — one small request the studio polls.
 */
export async function GET() {
  return handle(async (me) => {
    const jobs = activeJobs(clientsFor(me).map((c) => c.id)).map((j) => ({ ...j, alive: isRunning(j.id) }));
    return { jobs, unread: unreadCount(me.id) };
  });
}
