import { NextResponse } from "next/server";
import { driveAuthUrl, signToken, WorkflowError } from "@bolo/core";
import { authorizeManage } from "@/lib/access";
import { requireUser } from "@/lib/auth";

/** A company owner/admin starts the Google sign-in; the state is signed so the callback can't be forged. */
export async function GET(req: Request) {
  try {
    const me = await requireUser();
    const company = new URL(req.url).searchParams.get("company") ?? "";
    authorizeManage(me, company);
    return NextResponse.redirect(driveAuthUrl(signToken({ kind: "drive", uid: me.id, cid: company }, 600)));
  } catch (e) {
    const msg = e instanceof WorkflowError ? e.message : "Couldn't start Google sign-in.";
    return NextResponse.json({ error: msg }, { status: e instanceof WorkflowError ? e.status : 500 });
  }
}
