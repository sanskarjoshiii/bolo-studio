import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canManage, getStudio, unreadCount } from "@bolo/core";
import { StudioShell } from "@/components/studio/shell";
import { MeProvider } from "@/components/studio/me";
import { LiveProvider } from "@/components/studio/live";
import { requireUserPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Studio — Bolo Studio" };

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}`);
  const studio = getStudio(me);
  if (!studio.length) redirect("/onboarding");
  if (!studio.some((s) => s.client.id === clientId)) notFound();

  const tabs = studio.map(({ client, posts }) => ({
    id: client.id,
    name: client.name,
    mark: client.mark,
    rooms: client.rooms,
    awaiting: posts.filter((p) => p.status === "awaiting").length,
    checking: posts.filter((p) => p.status === "brand-check").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
  }));

  return (
    <MeProvider user={me}>
      <LiveProvider initialUnread={unreadCount(me.id)}>
        <StudioShell clients={tabs} clientId={clientId} isAdmin={me.role === "admin"} manager={canManage(me, clientId)}>
          {children}
        </StudioShell>
      </LiveProvider>
    </MeProvider>
  );
}
