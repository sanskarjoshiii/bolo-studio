import { notFound } from "next/navigation";
import { driveStatus, getClientStudio } from "@bolo/core";
import { EditorView } from "@/components/studio/editor-view";

export default async function PostEditorPage({ params }: { params: Promise<{ clientId: string; postId: string }> }) {
  const { clientId, postId } = await params;
  const { client, posts } = getClientStudio(clientId);
  const post = posts.find((p) => p.id === postId);
  if (!post) notFound();
  const drive = driveStatus();
  // key: when the saved post changes (save, agents, approval) the form restarts from it
  return (
    <EditorView
      key={post.updatedAt}
      client={client}
      post={post}
      drive={{ connected: drive.connected, folderUrl: drive.clients[clientId]?.references ?? null }}
    />
  );
}
