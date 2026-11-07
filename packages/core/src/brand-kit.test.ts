import { test } from "node:test";
import assert from "node:assert/strict";
import { parseApprovers, parseBestTimes, parseChecks, parseRera } from "./brand-kit";
import { listClients, loadClient } from "./companies";

test("parses approvers and backup approvers from protocol.md", () => {
  const md = "## Approval\n- Approver: Mr. X (Telegram @mr_x)\n- Backup approver: Ms. Y (Telegram @ms.y)\n";
  assert.deepEqual(parseApprovers(md), [
    { name: "Mr. X", handle: "@mr_x", backup: false },
    { name: "Ms. Y", handle: "@ms.y", backup: true },
  ]);
});

test("parses best posting times", () => {
  const md = "## Best posting times (IST)\n- Instagram / Facebook: 7:30 PM\n- LinkedIn: 10:00 AM, Tue–Thu\n\n## SLA\n- x";
  assert.deepEqual(parseBestTimes(md), [
    { label: "Instagram / Facebook", time: "7:30 PM" },
    { label: "LinkedIn", time: "10:00 AM, Tue–Thu" },
  ]);
});

test("parses RERA numbers and the bolo-checks block", () => {
  assert.deepEqual(parseRera("- RERA: P52100012345\n- RERA: P1"), ["P52100012345", "P1"]);
  assert.deepEqual(parseChecks('x\n```bolo-checks\n{ "requireRera": true }\n```'), { requireRera: true });
  assert.deepEqual(parseChecks("no block"), {});
});

test("loads every demo Brand Kit from disk", () => {
  const ids = listClients().map((c) => c.id);
  // Companies made in a local studio sit next to the demo kits — only the demo ones are checked.
  for (const id of ["pushpam-demo", "clinic-demo", "my-brand"]) assert.ok(ids.includes(id), `missing ${id}`);
  const pushpam = loadClient("pushpam-demo")!;
  assert.equal(pushpam.approvers[0].handle, "@rk_pushpam");
  assert.deepEqual(pushpam.reraNumbers, ["P52100012345"]);
  assert.deepEqual(pushpam.products, ["Luxe 28"]);
  assert.equal(pushpam.checks.maxHashtags?.instagram, 8);
});
