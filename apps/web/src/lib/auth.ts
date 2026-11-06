import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refreshStore, userFromSession, verifyToken, WorkflowError, type User } from "@bolo/core";

export const SESSION_COOKIE = "bolo_session";

/** The signed-in account. Also the moment each request picks up changes made by other servers. */
export async function currentUser(): Promise<User | null> {
  await refreshStore();
  return userFromSession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Pages: send signed-out visitors to /login and back afterwards. */
export async function requireUserPage(next: string): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export const AGENT_HEADER = "x-bolo-agent";

/**
 * Content agents (the `bolo` CLI on this machine) sign short-lived tokens with the same secret.
 * They act as members with no Telegram handle — they can produce and submit, never approve.
 */
async function agentUser(): Promise<User | null> {
  const token = (await headers()).get(AGENT_HEADER) ?? undefined;
  const p = verifyToken<{ kind: string; name: string }>(token);
  if (p?.kind !== "agent") return null;
  const name = String(p.name || "agent").slice(0, 40);
  return { id: `agent:${name}`, email: `${name}@agents.local`, username: name, name: `${name} (agent)`, role: "member", createdAt: new Date(0).toISOString() };
}

/** API routes: 401 without a session, 403 when an admin is required. */
export async function requireUser(opts: { admin?: boolean } = {}): Promise<User> {
  const user = (await currentUser()) ?? (await agentUser());
  if (!user) throw new WorkflowError(401, "Sign in first.");
  if (opts.admin && user.role !== "admin") throw new WorkflowError(403, "Only admins can do that.");
  return user;
}
