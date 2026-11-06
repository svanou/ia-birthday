import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile("wrangler.deploy.json", "utf8"));
const response = await fetch(config.vars.APP_URL + "/api/config", {
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw Error("Worker readiness endpoint is unavailable.");
const data = await response.json();
if (
  data.mode !== config.vars.APP_MODE ||
  data.sales !== false ||
  data.authReady !== true
)
  throw Error("Worker stage or secret configuration is not ready.");
console.log(
  `Worker configured at ${config.vars.APP_URL}. Sales remain closed. Real login, payment, generation and retention checks are still required.`,
);
