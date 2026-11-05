import { redirect } from "next/navigation";
import { listClients } from "@bolo/core";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const first = listClients()[0];
  redirect(first ? `/studio/${first.id}` : "/");
}
