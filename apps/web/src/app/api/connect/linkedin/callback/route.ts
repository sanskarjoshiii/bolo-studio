import { NextResponse } from "next/server";
import { refreshStore, connectLinkedIn, verifyToken, webUrl, WorkflowError } from "@bolo/core";

/** LinkedIn redirects here after the login. */
export async function GET(req: Request) {
  await refreshStore();
  const url = new URL(req.url);
  const state = verifyToken<{ kind: string; cid: string }>(url.searchParams.get("state") ?? undefined);
  if (state?.kind !== "linkedin" || !state.cid) return NextResponse.redirect(new URL("/dashboard", webUrl()));
  const back = (msg: string) => NextResponse.redirect(new URL(`/studio/${state.cid}/connections?linkedin=${encodeURIComponent(msg)}`, webUrl()));
  if (url.searchParams.get("error")) return back("cancelled");
  try {
    await connectLinkedIn(state.cid, url.searchParams.get("code") ?? "");
    return back("connected");
  } catch (e) {
    console.error("LinkedIn connect failed:", (e as Error).message);
    return back(e instanceof WorkflowError ? e.message : "failed");
  }
}
