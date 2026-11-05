import { getClientStudio } from "@bolo/core";
import { ApprovalsView } from "@/components/studio/approvals-view";

export default async function ApprovalsPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ post?: string }> }) {
  const { clientId } = await params;
  const { post } = await searchParams;
  const { client, posts } = getClientStudio(clientId);
  return <ApprovalsView client={client} posts={posts} selectedId={post ?? null} />;
}
