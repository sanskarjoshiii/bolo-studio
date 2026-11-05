import { NextResponse } from "next/server";
import { connectDrive, listClients, verifyToken } from "@bolo/core";

/** Google redirects here after consent. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/studio/${listClients()[0]?.id ?? ""}/connections?drive=${status}`, url.origin));
  if (url.searchParams.get("error")) return back("cancelled");
  if (verifyToken<{ kind: string }>(url.searchParams.get("state") ?? undefined)?.kind !== "drive") return back("invalid");
  try {
    await connectDrive(url.searchParams.get("code") ?? "");
    return back("connected");
  } catch (e) {
    console.error("Drive connect failed:", (e as Error).message);
    return back("failed");
  }
}
