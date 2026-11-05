"use client";

import { createContext, useContext } from "react";
import type { Client, User } from "@bolo/core";

const MeContext = createContext<User | null>(null);

export function MeProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return <MeContext.Provider value={user}>{children}</MeContext.Provider>;
}

export function useMe() {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside MeProvider");
  return me;
}

/** The signed-in user's approver entry for this client, if their Telegram handle is in protocol.md. */
export function useApproverFor(client: Client) {
  const me = useMe();
  const h = me.telegram?.replace(/^@/, "").toLowerCase();
  return h ? (client.approvers.find((a) => a.handle.replace(/^@/, "").toLowerCase() === h) ?? null) : null;
}
