import { NextResponse } from "next/server";
import { driveAuthUrl, signToken, WorkflowError } from "@bolo/core";
import { requireUser } from "@/lib/auth";

/** Admin starts the Google sign-in; state is signed so the callback can't be forged. */
export async function GET() {
  try {
    const me = await requireUser({ admin: true });
    return NextResponse.redirect(driveAuthUrl(signToken({ kind: "drive", uid: me.id }, 600)));
  } catch (e) {
    const msg = e instanceof WorkflowError ? e.message : "Couldn't start Google sign-in.";
    return NextResponse.json({ error: msg }, { status: e instanceof WorkflowError ? e.status : 500 });
  }
}
