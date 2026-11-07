import { NextResponse } from "next/server";
import { refreshStore, connectMeta, verifyToken, webUrl, WorkflowError } from "@bolo/core";

/** Facebook redirects here after the login. */
export async function GET(req: Request) {
  await refreshStore();
  const url = new URL(req.url);
  const state = verifyToken<{ kind: string; cid: string }>(url.searchParams.get("state") ?? undefined);
  if (state?.kind !== "meta" || !state.cid) return NextResponse.redirect(new URL("/dashboard", webUrl()));
  const back = (msg: string) => NextResponse.redirect(new URL(`/studio/${state.cid}/connections?meta=${encodeURIComponent(msg)}`, webUrl()));
  if (url.searchParams.get("error")) return back("cancelled");
  try {
    const { pages } = await connectMeta(state.cid, url.searchParams.get("code") ?? "");
    return back(pages > 1 ? "choose" : "connected");
  } catch (e) {
    console.error("Meta connect failed:", (e as Error).message);
    return back(e instanceof WorkflowError ? e.message : "failed");
  }
}
