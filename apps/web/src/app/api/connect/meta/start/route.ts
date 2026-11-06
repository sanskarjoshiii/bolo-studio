import { NextResponse } from "next/server";
import { metaAuthUrl, signToken, WorkflowError } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { requireUser } from "@/lib/auth";

/** "Continue with Facebook": Facebook Page + its Instagram business account, one login. */
export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company") ?? "";
  try {
    const me = await requireUser();
    authorizeManage(me, company);
    return NextResponse.redirect(metaAuthUrl(signToken({ kind: "meta", uid: me.id, cid: company }, 900)));
  } catch (e) {
    const msg = e instanceof WorkflowError ? e.message : "Couldn't start the Facebook login.";
    return NextResponse.redirect(new URL(`/studio/${company}/connections?meta=${encodeURIComponent(msg)}`, req.url));
  }
}
