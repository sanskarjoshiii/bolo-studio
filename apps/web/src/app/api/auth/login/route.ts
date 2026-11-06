import { NextResponse } from "next/server";
import { refreshStore, authenticate, createSession, SESSION_TTL } from "@bolo/core";
import { SESSION_COOKIE } from "@/lib/auth";

// Simple per-process throttle: 10 failed attempts per email per 15 minutes.
const failures = new Map<string, { count: number; until: number }>();

export async function POST(req: Request) {
  await refreshStore();
  const { email = "", password = "" } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const key = email.trim().toLowerCase();
  const f = failures.get(key);
  if (f && f.count >= 10 && f.until > Date.now()) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const user = authenticate(email, password);
  if (!user) {
    const prev = f && f.until > Date.now() ? f.count : 0;
    failures.set(key, { count: prev + 1, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }
  failures.delete(key);

  const res = NextResponse.json({ ok: true, user: { name: user.name } });
  res.cookies.set(SESSION_COOKIE, createSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}
