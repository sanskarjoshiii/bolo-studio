// "Try the demo": one shared demo account with a ready sample company, so judges and visitors can
// create designs and approve them without signing up. It can't connect real social accounts.
import { randomBytes } from "node:crypto";
import { createCompany } from "./companies";
import { readStore } from "./store";
import { createUser, findUserByLogin, type User } from "./users";

export const DEMO_EMAIL = "demo@bolostudio.app";

export const isDemoUser = (user: Pick<User, "email"> | null | undefined) => user?.email?.toLowerCase() === DEMO_EMAIL;

/** The demo account and its sample company — created on first use. */
export async function demoAccount(): Promise<{ user: User; companyId: string }> {
  const user =
    findUserByLogin(DEMO_EMAIL) ??
    (await createUser({ email: DEMO_EMAIL, name: "Demo visitor", password: randomBytes(24).toString("hex"), role: "member" }));
  const own = readStore().companies.find((c) => c.members.some((m) => m.userId === user.id));
  if (own) return { user, companyId: own.id };
  const c = await createCompany(user, { name: "Chai Katta Pune", sector: "Café", primary: "#7A3E1D", accent: "#F2B544" });
  return { user, companyId: c.id };
}
