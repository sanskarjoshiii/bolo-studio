import { canManage, getClientStudio } from "@bolo/core";
import { BrandKitEditor } from "@/components/studio/brand-kit-editor";
import { requireUserPage } from "@/lib/auth";

/** The company's Brand Kit — owners and admins edit it here; every AI and agent reads it. */
export default async function BrandKitPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ tab?: string; file?: string }> }) {
  const { clientId } = await params;
  const { tab, file } = await searchParams;
  const me = await requireUserPage(`/studio/${clientId}/brand-kit`);
  const { client } = getClientStudio(clientId);
  return <BrandKitEditor key={client.files.map((f) => f.content.length).join(":")} client={client} editable={canManage(me, clientId)} initialTab={tab} initialFile={file} />;
}
