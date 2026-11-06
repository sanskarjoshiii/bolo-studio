import { listNotifications, unreadCount } from "@bolo/core";
import { handle } from "@/lib/api-route";

export async function GET() {
  return handle(async (me) => ({ notifications: listNotifications(me.id), unread: unreadCount(me.id) }));
}
