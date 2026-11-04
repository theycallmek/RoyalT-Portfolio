// npm run homelab:token -- <id>
// Prints a new random agent token (for that machine's /etc/homelab-agent.env only) and the
// HOMELAB_NODES entry with its sha256 (for the server .env). Nothing is written to disk.
import { randomBytes } from "node:crypto";
import { sha256 } from "../server/homelab.ts";

const KNOWN: Record<string, [string, string]> = {
  web: ["web server", "x86 laptop"],
  bot: ["discord bot", "ARM board"],
  router: ["router", "ARM board"],
};

const id = process.argv[2] ?? "";
if (!/^[a-z0-9-]{1,32}$/.test(id)) {
  console.error("usage: npm run homelab:token -- <id>   (a-z, 0-9, -)");
  process.exit(1);
}
const [label, hw] = KNOWN[id] ?? ["<public label>", "<hardware class>"];
const token = randomBytes(32).toString("hex");
console.log(
  `Token for "${id}" (HOMELAB_TOKEN on that machine only):\n${token}\n`,
);
console.log("HOMELAB_NODES entry (server .env):");
console.log(JSON.stringify({ id, label, hw, tokenSha256: sha256(token) }));
