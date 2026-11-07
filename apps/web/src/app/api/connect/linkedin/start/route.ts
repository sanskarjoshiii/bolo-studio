import { NextResponse } from "next/server";
import { linkedinAuthUrl, signToken, WorkflowError, isDemoUser } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { requireUser } from "@/lib/auth";

/** "Continue with LinkedIn". */
export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company") ?? "";
  try {
    const me = await requireUser();
    authorizeManage(me, company);
    if (isDemoUser(me)) throw new WorkflowError(403, "The demo company can't connect real accounts — sign up to connect your own.");
    return NextResponse.redirect(linkedinAuthUrl(signToken({ kind: "linkedin", uid: me.id, cid: company }, 900)));
  } catch (e) {
    const msg = e instanceof WorkflowError ? e.message : "Couldn't start the LinkedIn login.";
    return NextResponse.redirect(new URL(`/studio/${company}/connections?linkedin=${encodeURIComponent(msg)}`, req.url));
  }
}
