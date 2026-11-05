import { redirect } from "next/navigation";

/** Publishing status now lives on Connections (with the queue). */
export default async function PublishingPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/studio/${clientId}/connections`);
}
