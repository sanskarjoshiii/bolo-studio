import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.BOLO_DATA_DIR = mkdtempSync(join(tmpdir(), "bolo-users-"));
delete process.env.AUTH_SECRET;

const u = await import("./users");

test("first user, login, wrong password, duplicate email", async () => {
  assert.equal(u.hasUsers(), false);
  const admin = await u.createUser({ email: "Kamran@7P.in ", name: "Kamran", password: "correct horse", role: "admin", telegram: "pathankamran_03" });
  assert.equal(admin.email, "kamran@7p.in");
  assert.equal(admin.telegram, "@pathankamran_03");
  assert.equal(JSON.stringify(admin).includes("passwordHash"), false);

  assert.equal(u.authenticate("kamran@7p.in", "correct horse")?.id, admin.id);
  assert.equal(u.authenticate("kamran@7p.in", "wrong"), null);
  assert.equal(u.authenticate("nobody@7p.in", "correct horse"), null);
  await assert.rejects(() => u.createUser({ email: "kamran@7p.in", name: "X", password: "12345678", role: "member" }), /already has an account/);
  await assert.rejects(() => u.createUser({ email: "a@b.co", name: "X", password: "short", role: "member" }), /at least 8/);
});

test("sessions are signed: tampering or expiry is rejected", () => {
  const user = u.listUsers()[0];
  const token = u.createSession(user);
  assert.equal(u.userFromSession(token)?.id, user.id);

  const [body, mac] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "someone-else", kind: "session", exp: 9e9 })).toString("base64url");
  assert.equal(u.userFromSession(`${forged}.${mac}`), null);
  assert.equal(u.userFromSession(`${body}.x${mac.slice(1)}`), null);
  assert.equal(u.verifyToken(u.signToken({ kind: "render" }, -1)), null);
});

test("logout and password change end existing sessions", async () => {
  const user = u.listUsers()[0];
  const a = u.createSession(user);
  await u.endSessions(user.id);
  assert.equal(u.userFromSession(a), null);
  const b = u.createSession(user);
  assert.equal(u.userFromSession(b)?.id, user.id);
  await u.updateUser(user.id, { password: "a brand new password" });
  assert.equal(u.userFromSession(b), null);
});

test("the last admin can't be removed or demoted", async () => {
  const admin = u.listUsers().find((x) => x.role === "admin")!;
  await assert.rejects(() => u.deleteUser(admin.id), /at least one admin/);
  await assert.rejects(() => u.updateUser(admin.id, { role: "member" }), /at least one admin/);
});
