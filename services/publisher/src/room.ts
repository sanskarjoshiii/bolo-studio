import { clientReply, getStudio, postRef, sameRoom, WorkflowError } from "@bolo/core";

// The Publisher works for the agency across every company (Switch is a platform service).
const AGENCY = { id: "agent:bolo-publisher", role: "admin" as const };

export type RoomMessage = {
  /** Room name as Switch reports it, e.g. "Pushpam × 7P Approvals". */
  room: string;
  /** Telegram @username of the sender — Switch identifies people by it. */
  author: string;
  text: string;
  /** Optional: the post this reply is about. Otherwise taken from "#ref" in the text, or the only post waiting. */
  postId?: string;
};

/**
 * One handler for every inbound approvals-room message, whatever transport delivered it
 * (the Switch WebSocket, or the HTTP relay for testing).
 */
export async function handleRoomMessage(msg: RoomMessage) {
  const text = msg.text.trim();
  if (!/^(approve|change|reject)\b/i.test(text)) return { handled: false as const, reason: "Not an approval command." };

  const entry = getStudio(AGENCY).find((s) => sameRoom(s.client.rooms.approvals, msg.room));
  if (!entry) throw new WorkflowError(404, `No client uses “${msg.room}” as its approvals room.`);

  const waiting = entry.posts.filter((p) => p.status === "awaiting");
  const ref = text.match(/#([a-z0-9]{3,})/i)?.[1]?.toLowerCase();

  let target = msg.postId ? entry.posts.find((p) => p.id === msg.postId) : undefined;
  if (!target && ref) target = waiting.find((p) => postRef(p) === `#${ref}`);
  if (!target && !ref && waiting.length === 1) target = waiting[0];

  if (!target) {
    if (!waiting.length) throw new WorkflowError(409, "Nothing is waiting for approval in this room.");
    throw new WorkflowError(
      409,
      `${ref ? `No post ${"#" + ref} is waiting. ` : ""}Which one? ${waiting.map((p) => `${postRef(p)} ${p.title}`).join(" · ")} — reply e.g. “approve ${postRef(waiting[0])}”, “change ${postRef(waiting[0])}: …” or “reject ${postRef(waiting[0])}”.`,
    );
  }

  // "change #ref: …" → "change: …" for the workflow
  const normalized = text
    .replace(/^(change)\s*#\w+\s*:/i, "change:")
    .replace(/^(approve)\s*#\w+/i, "approve")
    .replace(/^(reject)\s*#\w+\s*:?/i, "reject:");
  // The message came from this company's own approvals room, so "Anyone in the group can approve"
  // (Team) applies there; otherwise the sender must be one of its approvers (by Telegram username).
  const post = await clientReply(target.id, { handle: msg.author, name: msg.author, inGroup: true, text: normalized, via: "telegram" });
  return { handled: true as const, post };
}
