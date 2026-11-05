import { redirect } from "next/navigation";
import { listClients } from "@bolo/core";

export const dynamic = "force-dynamic";

export default function StudioIndex() {
  const first = listClients()[0];
  redirect(first ? `/studio/${first.id}` : "/");
}
