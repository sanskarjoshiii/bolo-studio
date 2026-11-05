import { NextResponse } from "next/server";
import { createSession, createUser, hasUsers, SESSION_TTL, WorkflowError } from "@bolo/core";
import { SESSION_COOKIE } from "@/lib/auth";

/** First run only: create the admin account. Closed for good once any user exists. */
export async function POST(req: Request) {
  if (hasUsers()) return NextResponse.json({ error: "Setup is already done — sign in instead." }, { status: 409 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; name?: string; password?: string; telegram?: string };
  try {
    const user = createUser({ email: b.email ?? "", name: b.name ?? "", password: b.password ?? "", telegram: b.telegram, role: "admin" });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSession(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL,
    });
    return res;
  } catch (e) {
    if (e instanceof WorkflowError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
