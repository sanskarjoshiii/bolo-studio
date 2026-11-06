import { canManage, connectionStatus, getClientStudio } from "@bolo/core";
import { ConnectionsView } from "@/components/studio/connections-view";
import { requireUserPage } from "@/lib/auth";

type Search = { drive?: string; meta?: string; linkedin?: string; welcome?: string };

const MESSAGES: Record<string, string> = {
  connected: "Connected.",
  choose: "Logged in — now pick the Page to post to.",
  cancelled: "You cancelled the login — nothing changed.",
  invalid: "That link expired — click Connect again.",
  failed: "Something went wrong — try again.",
};

/** What this company connects — each with plain-language steps. Platform services live on the admin Platform page. */
export default async function ConnectionsPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<Search> }) {
  const { clientId } = await params;
  const q = await searchParams;
  const me = await requireUserPage(`/studio/${clientId}/connections`);
  const { client } = getClientStudio(clientId);
  const flash = (["drive", "meta", "linkedin"] as const)
    .filter((k) => q[k])
    .map((k) => ({ kind: k, ok: q[k] === "connected" || q[k] === "choose", text: MESSAGES[q[k]!] ?? q[k]! }));
  return <ConnectionsView client={client} status={connectionStatus(clientId)} manager={canManage(me, clientId)} flash={flash} welcome={q.welcome === "1"} />;
}
