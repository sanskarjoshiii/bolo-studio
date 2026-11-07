import { NextResponse } from "next/server";
import { refreshStore, connectDrive, verifyToken, webUrl } from "@bolo/core";

/** Google redirects here after consent. */
export async function GET(req: Request) {
  await refreshStore();
  const url = new URL(req.url);
  const state = verifyToken<{ kind: string; cid: string; uid: string }>(url.searchParams.get("state") ?? undefined);
  const back = (status: string) => NextResponse.redirect(new URL(state?.cid ? `/studio/${state.cid}/connections?drive=${status}` : "/dashboard", webUrl()));
  if (state?.kind !== "drive" || !state.cid) return back("invalid");
  if (url.searchParams.get("error")) return back("cancelled");
  try {
    await connectDrive(state.cid, url.searchParams.get("code") ?? "");
    return back("connected");
  } catch (e) {
    console.error("Drive connect failed:", (e as Error).message);
    return back("failed");
  }
}
