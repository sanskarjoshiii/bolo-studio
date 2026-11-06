import { redirect } from "next/navigation";
import { clientsFor } from "@bolo/core";
import { requireUserPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Into the first company this account belongs to — or onboarding when it has none yet. */
export default async function DashboardPage() {
  const me = await requireUserPage("/dashboard");
  const first = clientsFor(me)[0];
  redirect(first ? `/studio/${first.id}` : "/onboarding");
}
