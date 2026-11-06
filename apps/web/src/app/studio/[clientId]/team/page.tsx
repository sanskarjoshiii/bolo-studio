import { canManage, getClientStudio, listInvites } from "@bolo/core";
import { TeamView } from "@/components/studio/team-view";
import { requireUserPage } from "@/lib/auth";

export default async function TeamPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}/team`);
  const { client } = getClientStudio(clientId);
  const manager = canManage(me, clientId);
  return <TeamView me={me} client={client} manager={manager} invites={manager ? listInvites(clientId) : []} />;
}
