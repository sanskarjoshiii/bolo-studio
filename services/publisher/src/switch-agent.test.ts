import { test } from "node:test";
import assert from "node:assert/strict";
import { telegramHandle } from "./switch-agent";

const BRIDGE = "cbd16be8-65df-47b5-be87-5782778b4c4d";

test("reads the Telegram username from a bridge-assigned sender id (shape seen live)", () => {
  assert.equal(telegramHandle(`@switch-telegram-${BRIDGE}-pathankamran_03:localhost`, BRIDGE), "@pathankamran_03");
});

test("refuses ids from another bridge, other apps, or anything malformed", () => {
  assert.equal(telegramHandle(`@switch-telegram-${BRIDGE}-pathankamran_03:localhost`, "00000000-0000-0000-0000-000000000000"), null);
  assert.equal(telegramHandle("@switch-mattermost-user-pathankamran_03:localhost", BRIDGE), null);
  assert.equal(telegramHandle("pathankamran_03", BRIDGE), null);
  assert.equal(telegramHandle(`@switch-telegram-${BRIDGE}-ab:localhost`, BRIDGE), null); // too short for a username
});
