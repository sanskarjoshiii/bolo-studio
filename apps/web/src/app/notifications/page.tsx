import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clientsFor, listNotifications, unreadCount } from "@bolo/core";
import { NotificationsPage } from "@/components/studio/notifications-page";
import { LiveProvider } from "@/components/studio/live";
import { LogoMark } from "@/components/ui/logo";
import { requireUserPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications — Bolo Studio" };

export default async function Page() {
  const me = await requireUserPage("/notifications");
  const home = clientsFor(me)[0];
  return (
    <LiveProvider initialUnread={unreadCount(me.id)}>
      <main className="min-h-dvh bg-night px-4 py-8 text-white" style={{ backgroundImage: "radial-gradient(900px 500px at 20% -10%, rgba(38,92,68,0.5), transparent 60%)" }}>
        <div className="mx-auto max-w-[680px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[15px] font-semibold text-lime">
              <LogoMark className="size-5" /> <span className="text-white">Bolo Studio</span>
            </span>
            <Link href={home ? `/studio/${home.id}` : "/onboarding"} className="flex items-center gap-1.5 text-[13px] text-fog hover:text-white">
              <ArrowLeft className="size-3.5" /> Back to the studio
            </Link>
          </div>
          <NotificationsPage initial={listNotifications(me.id, 200)} />
        </div>
      </main>
    </LiveProvider>
  );
}
