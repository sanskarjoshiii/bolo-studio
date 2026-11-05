// One-time: register the Publisher as a Switch agent and save its credentials to .env.
// Usage: npm run switch:register                  uses SWITCH_REGISTRATION_KEY from .env
//        npm run switch:register -- --local       uses the registration token of the local server Switch Console runs
//        add --force to issue a new key (the old one stops working)
import { writeEnv } from "./env-file";
import { bridgeUrl, registrationKey } from "./switch-config";

const NAME = "bolo-publisher";
const force = process.argv.includes("--force");
const local = process.argv.includes("--local");

if (process.env.SWITCH_AGENT_ID && process.env.SWITCH_AGENT_API_KEY && !force) {
  console.log(`Already registered (agent ${process.env.SWITCH_AGENT_ID}). Use --force to issue a new key.`);
  process.exit(0);
}

const base = bridgeUrl();
const res = await fetch(`${base}/agents`, {
  method: "POST",
  headers: { Authorization: `Bearer ${registrationKey(local)}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: NAME,
    display_name: "Publisher",
    description:
      "Bolo Studio Publisher. Schedules approved posts in Postiz and posts the live link back. Acts only on “approve” from approvers listed in the client's protocol.md.",
    connector_type: "bolo-publisher",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
    overwrite: force,
  }),
});

const body = (await res.json().catch(() => ({}))) as { id?: string; api_key?: string; detail?: unknown };
if (res.status === 409) {
  console.error(`An agent named “${NAME}” already exists but its key isn't in .env. Re-run with --force to issue a new key.`);
  process.exit(1);
}
if (!res.ok || !body.id || !body.api_key) {
  console.error(`Registration failed (${res.status}):`, JSON.stringify(body));
  process.exit(1);
}

writeEnv({ SWITCH_BRIDGE_URL: base, SWITCH_AGENT_ID: body.id, SWITCH_AGENT_API_KEY: body.api_key });
console.log(`Registered “${NAME}” → agent ${body.id}. Credentials saved to .env (key not printed).`);
console.log(`Next: in the Telegram approvals group type  !invite-agent @${NAME}`);
