import { listClients, listUsers } from "@bolo/core";
import { TeamView } from "@/components/studio/team-view";
import { requireUserPage } from "@/lib/auth";

export default async function TeamPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const me = await requireUserPage(`/studio/${clientId}/team`);
  const clients = listClients();
  // Which clients each person can approve for (their Telegram handle is in that protocol.md)
  const approverOf = Object.fromEntries(
    listUsers().map((u) => {
      const h = u.telegram?.replace(/^@/, "").toLowerCase();
      return [u.id, h ? clients.filter((c) => c.approvers.some((a) => a.handle.replace(/^@/, "").toLowerCase() === h)).map((c) => c.name) : []];
    }),
  );
  return <TeamView me={me} users={listUsers()} approverOf={approverOf} />;
}
