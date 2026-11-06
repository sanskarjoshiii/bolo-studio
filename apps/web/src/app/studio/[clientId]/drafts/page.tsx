import { getClientStudio } from "@bolo/core";
import { DraftsView } from "@/components/studio/drafts-view";

/** Approved posts — designs and reels — waiting to go out. */
export default async function DraftsPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ post?: string }> }) {
  const { clientId } = await params;
  const { post } = await searchParams;
  const { client, posts } = getClientStudio(clientId);
  return <DraftsView client={client} posts={posts.filter((p) => p.status === "scheduled")} selectedId={post ?? null} />;
}
