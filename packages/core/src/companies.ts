import { randomUUID } from "node:crypto";
import { CLIENT_ORDER, parseChecks, parseKit, writeDiskKit } from "./brand-kit";
import { WorkflowError } from "./errors";
import { readStore, storeGeneration, updateStore } from "./store";
import type { Approver, BrandKitFile, Client, ClientMeta, Company, Invite, Member, MemberInfo, MemberRole, Notification, NotificationKind, StudioData } from "./types";
import { getUser, usersGeneration, type User } from "./users";

// Companies (client workspaces): Brand Kit, team, approvers, invites and notifications.
// The store is the source of truth; brand-kits/<id>/ is the seed and a copy for the Switch agents.

const nowIso = () => new Date().toISOString();
const handleKey = (h?: string) => (h ?? "").replace(/^@/, "").trim().toLowerCase();

// ---------- reading clients ----------

let parsed: { key: string; byId: Map<string, Client> } | null = null;

function clientMap(): Map<string, Client> {
  const data = readStore();
  const key = `${storeGeneration()}:${usersGeneration()}`;
  if (parsed?.key === key) return parsed.byId;
  const byId = new Map<string, Client>();
  const ordered = [...data.companies].sort(
    (a, b) => (CLIENT_ORDER.indexOf(a.id) + 1 || 99) - (CLIENT_ORDER.indexOf(b.id) + 1 || 99) || a.createdAt.localeCompare(b.createdAt),
  );
  for (const c of ordered) byId.set(c.id, toClient(c));
  parsed = { key, byId };
  return byId;
}

function memberInfos(company: Company): MemberInfo[] {
  return company.members.flatMap((m) => {
    const u = getUser(m.userId);
    return u ? [{ ...m, name: u.name, email: u.email, username: u.username, telegram: u.telegram }] : [];
  });
}

const handleOf = (h: string) => `@${handleKey(h)}`;

/**
 * Who approves: the approvers in protocol.md, team members with "can approve", and Telegram
 * usernames added in Team (no Bolo account needed). The owners always approve too — a company that
 * sets nobody is approved by its owner alone (marked `owner`).
 */
export function approversFor(protocolApprovers: Approver[], members: MemberInfo[], telegram: string[] = []): Approver[] {
  const out: Approver[] = protocolApprovers.map((a) => {
    const linked = members.find((m) => m.telegram && handleKey(m.telegram) === handleKey(a.handle));
    return linked ? { ...a, userId: linked.userId } : a;
  });
  for (const m of members.filter((x) => x.canApprove)) {
    if (out.some((a) => a.userId === m.userId)) continue;
    out.push({ name: m.name, handle: m.telegram ?? "", backup: false, userId: m.userId });
  }
  for (const t of telegram) {
    if (out.some((a) => a.handle && handleKey(a.handle) === handleKey(t))) continue;
    const linked = members.find((m) => m.telegram && handleKey(m.telegram) === handleKey(t));
    out.push({ name: linked?.name ?? handleOf(t), handle: handleOf(t), backup: false, userId: linked?.userId });
  }
  const nobodySet = out.length === 0;
  for (const m of members.filter((x) => x.role === "owner")) {
    if (out.some((a) => a.userId === m.userId)) continue;
    out.push({ name: m.name, handle: m.telegram ?? "", backup: false, userId: m.userId, owner: nobodySet });
  }
  return out;
}

function toClient(company: Company): Client {
  const members = memberInfos(company);
  const client = parseKit(company.id, company.kit.meta, company.kit.files, members);
  client.telegramApprovers = company.approvals?.telegram ?? [];
  client.groupApproves = Boolean(company.approvals?.anyoneInGroup);
  client.approvers = approversFor(client.approvers, members, client.telegramApprovers);
  return client;
}

export function loadClient(id: string): Client | null {
  return clientMap().get(id) ?? null;
}

/** Every company, demo kits first. */
export function listClients(): Client[] {
  return [...clientMap().values()];
}

/** Companies this account can open: platform admins see all, everyone else their own. */
export function clientsFor(user: Pick<User, "id" | "role">): Client[] {
  const all = listClients();
  return user.role === "admin" ? all : all.filter((c) => c.members.some((m) => m.userId === user.id));
}

export function getCompany(id: string): Company | null {
  return readStore().companies.find((c) => c.id === id) ?? null;
}

// ---------- access ----------

export function membership(companyId: string, userId: string): Member | null {
  return getCompany(companyId)?.members.find((m) => m.userId === userId) ?? null;
}

/** Content agents (the bolo CLI) act for the agency, so they reach every company. */
const isAgent = (user: Pick<User, "id">) => user.id.startsWith("agent:");

export function canAccess(user: Pick<User, "id" | "role">, companyId: string) {
  return user.role === "admin" || isAgent(user) || Boolean(membership(companyId, user.id));
}

/** Team, Brand Kit and connections: the company's owners and admins (and platform admins). */
export function canManage(user: Pick<User, "id" | "role">, companyId: string) {
  if (user.role === "admin") return true;
  const m = membership(companyId, user.id);
  return m?.role === "owner" || m?.role === "admin";
}

export function requireAccess(user: Pick<User, "id" | "role">, companyId: string) {
  if (!getCompany(companyId)) throw new WorkflowError(404, "Company not found.");
  if (!canAccess(user, companyId)) throw new WorkflowError(403, "You're not a member of this company.");
}

export function requireManage(user: Pick<User, "id" | "role">, companyId: string) {
  requireAccess(user, companyId);
  if (!canManage(user, companyId)) throw new WorkflowError(403, "Only the company's owner or admins can do that.");
}

/** The approver entry for this account, if it may approve this company's posts. */
export function approverForUser(client: Client, user: Pick<User, "id" | "telegram">): Approver | null {
  return client.approvers.find((a) => a.userId === user.id || (a.handle && user.telegram && handleKey(a.handle) === handleKey(user.telegram))) ?? null;
}

// ---------- creating and editing ----------

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "company";

const HEX = /^#[0-9a-f]{6}$/i;

/** A starter Brand Kit for a new company — every file the agents expect, in plain language. */
export function starterKit(input: { name: string; sector: string; short?: string; primary?: string; accent?: string }): { meta: ClientMeta; files: BrandKitFile[] } {
  const name = input.name.trim();
  const short = (input.short?.trim() || name.split(/\s+/)[0]).slice(0, 24);
  const primary = HEX.test(input.primary ?? "") ? input.primary! : "#1F3A5F";
  const accent = HEX.test(input.accent ?? "") ? input.accent! : "#C9A227";
  const meta: ClientMeta = {
    name,
    short,
    sector: input.sector.trim() || "Business",
    mark: { bg: primary, fg: accent },
    rooms: { work: `#${slugify(short)}-work`, approvals: `${short} Approvals` },
    channels: [
      { platform: "instagram", handle: "" },
      { platform: "facebook", handle: "" },
      { platform: "linkedin", handle: "" },
    ],
  };
  const files: BrandKitFile[] = [
    {
      name: "brand.md",
      content: `# ${name} — brand voice\n\n## Who we are\n- ${meta.sector}\n\n## Tone\n- Warm, clear and confident\n- Short sentences; one idea per line\n\n## Languages\n- English\n`,
    },
    {
      name: "rules.md",
      content: `# Rules\n\n## Never\n- Promise results we can't guarantee\n- Mention competitors by name\n\n## Always\n- End captions with a clear call to action\n\n\`\`\`bolo-checks\n${JSON.stringify({ banned: [], competitors: [], maxHashtags: { instagram: 8, linkedin: 3 } }, null, 2)}\n\`\`\`\n`,
    },
    {
      name: "protocol.md",
      content: `# Protocol\n\n## Approval\n- Approvals happen in Bolo Studio (Approvals) or on Telegram once it's connected\n\n## Platforms\n- Instagram, Facebook, LinkedIn\n\n## Best posting times (IST)\n- Instagram / Facebook: 7:30 PM\n- LinkedIn: 10:00 AM\n`,
    },
    { name: "audience.md", content: `# Audience\n\n- Who buys from us, where they live, what they care about\n` },
    { name: "products.md", content: `# Products and services\n\n## ${short}\n- What it is, the price (if public) and who it's for\n` },
    { name: "tokens.json", content: `${JSON.stringify({ primary, accent, bg: "#F7F5F0", text: "#1A1A1A", fontHead: "Inter", fontBody: "Inter", safeMargin: 64, radius: 16 }, null, 2)}\n` },
  ];
  return { meta, files };
}

export async function createCompany(user: User, input: { name: string; sector: string; short?: string; primary?: string; accent?: string }) {
  if (!input.name?.trim()) throw new WorkflowError(400, "Enter the company name.");
  if (input.name.trim().length > 60) throw new WorkflowError(400, "Company name: 60 characters at most.");
  const kit = starterKit(input);
  const company = await updateStore((data) => {
    let id = slugify(input.name);
    for (let i = 2; data.companies.some((c) => c.id === id); i++) id = `${slugify(input.name).slice(0, 28)}-${i}`;
    const c: Company = { id, kit, members: [{ userId: user.id, role: "owner", canApprove: false, addedAt: nowIso() }], connections: {}, createdAt: nowIso(), createdBy: user.id };
    data.companies.push(c);
    data.settings[id] = { cadence: "3x/week", useBestTimes: true, remindApprover: true, autoFix: true };
    return c;
  });
  writeDiskKit(company.id, company.kit);
  return loadClient(company.id)!;
}

const KIT_FILE = /^[a-z0-9][\w.-]{0,40}\.(md|json)$/i;

/**
 * Brand Kit edits from the studio: client.json fields and whole files. Invalid rules or tokens are
 * refused with the reason, so a typo can't break Brand Guard or the designs.
 */
export async function updateKit(companyId: string, patch: { meta?: Partial<ClientMeta>; files?: BrandKitFile[]; removeFiles?: string[] }) {
  for (const f of patch.files ?? []) {
    if (!KIT_FILE.test(f.name)) throw new WorkflowError(400, `“${f.name}”: file names are letters, numbers and dashes, ending .md or .json.`);
    if (f.content.length > 200_000) throw new WorkflowError(400, `${f.name} is too long.`);
    if (f.name === "rules.md") {
      try {
        parseChecks(f.content);
      } catch (e) {
        throw new WorkflowError(400, (e as Error).message);
      }
    }
    if (f.name.endsWith(".json")) {
      try {
        JSON.parse(f.content);
      } catch (e) {
        throw new WorkflowError(400, `${f.name} isn't valid JSON: ${(e as Error).message}`);
      }
    }
  }
  if (patch.removeFiles?.some((n) => ["brand.md", "rules.md", "protocol.md", "tokens.json"].includes(n))) {
    throw new WorkflowError(400, "brand.md, rules.md, protocol.md and tokens.json are required — edit them instead.");
  }
  const m = patch.meta;
  if (m?.name !== undefined && !m.name.trim()) throw new WorkflowError(400, "The company needs a name.");
  if (m?.mark && (!HEX.test(m.mark.bg) || !HEX.test(m.mark.fg))) throw new WorkflowError(400, "Colours are #RRGGBB.");

  const company = await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    if (m) {
      const meta = c.kit.meta;
      if (m.name !== undefined) meta.name = m.name.trim().slice(0, 60);
      if (m.short !== undefined) meta.short = m.short.trim().slice(0, 24) || meta.short;
      if (m.sector !== undefined) meta.sector = m.sector.trim().slice(0, 80);
      if (m.mark) meta.mark = { ...meta.mark, bg: m.mark.bg, fg: m.mark.fg };
      // The Switch rooms this company uses (set by Bolo Studio admins)
      if (m.rooms) meta.rooms = { work: m.rooms.work?.trim().slice(0, 120) ?? meta.rooms.work, approvals: m.rooms.approvals?.trim().slice(0, 120) ?? meta.rooms.approvals };
      if (m.channels) meta.channels = m.channels.filter((ch) => ["instagram", "facebook", "linkedin", "youtube"].includes(ch.platform)).map((ch) => ({ ...ch, handle: ch.handle.trim().slice(0, 80) }));
    }
    for (const f of patch.files ?? []) {
      const i = c.kit.files.findIndex((x) => x.name === f.name);
      if (i >= 0) c.kit.files[i] = { name: f.name, content: f.content };
      else c.kit.files.push({ name: f.name, content: f.content });
    }
    if (patch.removeFiles?.length) c.kit.files = c.kit.files.filter((f) => !patch.removeFiles!.includes(f.name));
    return structuredClone(c);
  });
  writeDiskKit(company.id, company.kit);
  return loadClient(companyId)!;
}

// ---------- team ----------

const ROLES: MemberRole[] = ["owner", "admin", "member"];

/** Send an invite to an existing account (by email or username); they accept from Notifications. */
export async function inviteMember(companyId: string, by: User, target: User, opts: { role?: MemberRole; canApprove?: boolean } = {}) {
  const role = ROLES.includes(opts.role as MemberRole) && opts.role !== "owner" ? opts.role! : "member";
  return updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    if (c.members.some((mm) => mm.userId === target.id)) throw new WorkflowError(409, `${target.name} is already in ${c.kit.meta.name}.`);
    if (data.invites.some((i) => i.companyId === companyId && i.userId === target.id && i.status === "pending")) {
      throw new WorkflowError(409, `${target.name} already has an invite waiting.`);
    }
    const invite: Invite = { id: randomUUID().slice(0, 12), companyId, userId: target.id, invitedBy: by.id, role, canApprove: Boolean(opts.canApprove), status: "pending", createdAt: nowIso() };
    data.invites.push(invite);
    pushNotification(data, target.id, {
      kind: "invite",
      title: `${by.name} invited you to ${c.kit.meta.name}`,
      body: `Join as ${role}${invite.canApprove ? " · can approve posts" : ""}.`,
      companyId,
      inviteId: invite.id,
    });
    return invite;
  });
}

export async function respondInvite(inviteId: string, user: User, accept: boolean) {
  const result = await updateStore((data) => {
    const invite = data.invites.find((i) => i.id === inviteId);
    if (!invite || invite.userId !== user.id) throw new WorkflowError(404, "Invite not found.");
    if (invite.status !== "pending") throw new WorkflowError(409, `This invite was already ${invite.status}.`);
    const c = data.companies.find((x) => x.id === invite.companyId);
    if (!c) throw new WorkflowError(404, "That company no longer exists.");
    invite.status = accept ? "accepted" : "declined";
    invite.respondedAt = nowIso();
    if (accept && !c.members.some((m) => m.userId === user.id)) {
      c.members.push({ userId: user.id, role: invite.role, canApprove: invite.canApprove, addedAt: nowIso() });
    }
    // The invite notification is answered; tell whoever sent it
    for (const n of data.notifications) if (n.inviteId === inviteId && n.userId === user.id) n.read = true;
    pushNotification(data, invite.invitedBy, {
      kind: "member",
      title: `${user.name} ${accept ? "joined" : "declined to join"} ${c.kit.meta.name}`,
      companyId: c.id,
      href: `/studio/${c.id}/team`,
    });
    return { invite, companyId: c.id };
  });
  return result;
}

export async function cancelInvite(companyId: string, inviteId: string) {
  return updateStore((data) => {
    const invite = data.invites.find((i) => i.id === inviteId && i.companyId === companyId);
    if (!invite || invite.status !== "pending") throw new WorkflowError(404, "No pending invite.");
    invite.status = "cancelled";
    invite.respondedAt = nowIso();
    data.notifications = data.notifications.filter((n) => n.inviteId !== inviteId);
    return invite;
  });
}

export function listInvites(companyId: string) {
  return readStore()
    .invites.filter((i) => i.companyId === companyId && i.status === "pending")
    .map((i) => {
      const u = getUser(i.userId);
      return { ...i, name: u?.name ?? "Unknown", email: u?.email ?? "", username: u?.username ?? "" };
    });
}

/** Invites waiting for this account (shown in Notifications and on the onboarding page). */
export function invitesFor(userId: string) {
  const data = readStore();
  return data.invites
    .filter((i) => i.userId === userId && i.status === "pending")
    .map((i) => ({ ...i, companyName: data.companies.find((c) => c.id === i.companyId)?.kit.meta.name ?? i.companyId, invitedByName: getUser(i.invitedBy)?.name ?? "Someone" }));
}

export async function updateMember(companyId: string, userId: string, patch: { role?: MemberRole; canApprove?: boolean }) {
  return updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    const m = c?.members.find((x) => x.userId === userId);
    if (!c || !m) throw new WorkflowError(404, "Member not found.");
    if (patch.role && !ROLES.includes(patch.role)) throw new WorkflowError(400, "Role must be owner, admin or member.");
    if (patch.role && patch.role !== "owner" && m.role === "owner" && c.members.filter((x) => x.role === "owner").length === 1) {
      throw new WorkflowError(409, "A company needs at least one owner — make someone else owner first.");
    }
    if (patch.role) m.role = patch.role;
    if (typeof patch.canApprove === "boolean") m.canApprove = patch.canApprove;
    return m;
  });
}

export async function removeMember(companyId: string, userId: string) {
  return updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    const m = c?.members.find((x) => x.userId === userId);
    if (!c || !m) throw new WorkflowError(404, "Member not found.");
    if (m.role === "owner" && c.members.filter((x) => x.role === "owner").length === 1) {
      throw new WorkflowError(409, "The last owner can't leave — make someone else owner first.");
    }
    c.members = c.members.filter((x) => x.userId !== userId);
    return { userId };
  });
}

/** Telegram approvers (usernames, no account needed) and the "anyone in the group" switch. */
export async function updateApprovals(companyId: string, patch: { telegram?: string[]; anyoneInGroup?: boolean }) {
  const telegram = patch.telegram?.map((t) => t.trim().replace(/^@/, "")).filter(Boolean);
  for (const t of telegram ?? []) {
    if (!/^[A-Za-z0-9_]{5,32}$/.test(t)) throw new WorkflowError(400, `“${t}” isn't a Telegram username (5–32 letters, numbers or underscores).`);
  }
  if (telegram && telegram.length > 30) throw new WorkflowError(400, "30 Telegram approvers at most.");
  await updateStore((data) => {
    const c = data.companies.find((x) => x.id === companyId);
    if (!c) throw new WorkflowError(404, "Company not found.");
    const cur = c.approvals ?? { telegram: [], anyoneInGroup: false };
    c.approvals = {
      telegram: telegram ? [...new Set(telegram.map((t) => `@${t.toLowerCase()}`))] : cur.telegram,
      anyoneInGroup: typeof patch.anyoneInGroup === "boolean" ? patch.anyoneInGroup : cur.anyoneInGroup,
    };
  });
  return loadClient(companyId)!;
}

// ---------- notifications ----------

const MAX_PER_USER = 200;

/** Add a notification inside a running updateStore (keeps the newest 200 per person). */
export function pushNotification(data: StudioData, userId: string, n: { kind: NotificationKind; title: string; body?: string; href?: string; companyId?: string; inviteId?: string }) {
  if (!userId || userId.startsWith("agent:")) return;
  data.notifications.push({ id: randomUUID().slice(0, 12), userId, read: false, createdAt: nowIso(), ...n });
  const mine = data.notifications.filter((x) => x.userId === userId);
  if (mine.length > MAX_PER_USER) {
    const drop = new Set(mine.slice(0, mine.length - MAX_PER_USER).map((x) => x.id));
    data.notifications = data.notifications.filter((x) => !drop.has(x.id));
  }
}

export function notify(userIds: string[], n: Parameters<typeof pushNotification>[2]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return Promise.resolve();
  return updateStore((data) => {
    for (const id of ids) pushNotification(data, id, n);
  });
}

export function listNotifications(userId: string, limit = 60): Notification[] {
  return readStore()
    .notifications.filter((n) => n.userId === userId)
    .slice(-limit)
    .reverse();
}

export function unreadCount(userId: string) {
  return readStore().notifications.filter((n) => n.userId === userId && !n.read).length;
}

export function markNotificationsRead(userId: string, ids?: string[]) {
  return updateStore((data) => {
    for (const n of data.notifications) if (n.userId === userId && (!ids || ids.includes(n.id))) n.read = true;
  });
}

/** People to tell about a company's posts: its owners and admins. */
export function managersOf(companyId: string) {
  return (getCompany(companyId)?.members ?? []).filter((m) => m.role !== "member").map((m) => m.userId);
}
