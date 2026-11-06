import { NextResponse } from "next/server";
import { refreshStore, createSession, createUser, hasUsers, SESSION_TTL, WorkflowError } from "@bolo/core";
import { SESSION_COOKIE } from "@/lib/auth";

// Per-process throttle on sign-ups from one address: 10 an hour.
const recent = new Map<string, number[]>();

/** Anyone can create an account; they then create their company or accept an invite. */
export async function POST(req: Request) {
  await refreshStore();
  if (!hasUsers()) return NextResponse.json({ error: "Finish the first-run setup first." }, { status: 409 });
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const times = (recent.get(ip) ?? []).filter((t) => t > Date.now() - 3_600_000);
  if (times.length >= 10) return NextResponse.json({ error: "Too many sign-ups from here — try again later." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; name?: string; password?: string; username?: string };
  try {
    const user = await createUser({ email: b.email ?? "", name: b.name ?? "", password: b.password ?? "", username: b.username, role: "member" });
    recent.set(ip, [...times, Date.now()]);
    const res = NextResponse.json({ ok: true, user: { name: user.name, username: user.username } });
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
