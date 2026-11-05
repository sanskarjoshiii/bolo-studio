import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudio } from "@bolo/core";
import { StudioShell } from "@/components/studio/shell";
import { MeProvider } from "@/components/studio/me";
import { requireUserPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Studio — Bolo Studio" };

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}`);
  const studio = getStudio();
  if (!studio.some((s) => s.client.id === clientId)) notFound();

  const tabs = studio.map(({ client, posts }) => ({
    id: client.id,
    name: client.name,
    mark: client.mark,
    rooms: client.rooms,
    awaiting: posts.filter((p) => p.status === "awaiting").length,
    checking: posts.filter((p) => p.status === "brand-check").length,
  }));

  return (
    <MeProvider user={me}>
      <StudioShell clients={tabs} clientId={clientId}>
        {children}
      </StudioShell>
    </MeProvider>
  );
}
