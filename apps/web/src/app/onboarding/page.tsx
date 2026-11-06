import type { Metadata } from "next";
import { clientsFor, invitesFor } from "@bolo/core";
import { OnboardingView } from "@/components/studio/onboarding-view";
import { requireUserPage } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get started — Bolo Studio" };

export default async function OnboardingPage() {
  const me = await requireUserPage("/onboarding");
  return <OnboardingView name={me.name} invites={invitesFor(me.id)} hasCompanies={clientsFor(me).length > 0} />;
}
