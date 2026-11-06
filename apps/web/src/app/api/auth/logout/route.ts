import { NextResponse } from "next/server";
import { endSessions } from "@bolo/core";
import { currentUser, SESSION_COOKIE } from "@/lib/auth";

/** Signs the user out on every device, not just this browser. */
export async function POST() {
  const me = await currentUser();
  if (me) await endSessions(me.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
