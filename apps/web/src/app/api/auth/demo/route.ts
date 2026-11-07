import { NextResponse } from "next/server";
import { refreshStore, createSession, demoAccount, SESSION_TTL, webUrl } from "@bolo/core";
import { SESSION_COOKIE } from "@/lib/auth";

/** "Try the demo": signs in to the shared demo account and opens its sample company. */
export async function GET() {
  await refreshStore();
  const { user, companyId } = await demoAccount();
  const res = NextResponse.redirect(new URL(`/studio/${companyId}`, webUrl()));
  res.cookies.set(SESSION_COOKIE, createSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}
