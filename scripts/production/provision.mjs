import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function optionsFrom(env, stage = "pilot") {
  if (!["pilot", "live"].includes(stage))
    throw Error("Stage must be pilot or live.");
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!account || !/^[a-f0-9]{32}$/i.test(account))
    throw Error(
      "CLOUDFLARE_ACCOUNT_ID is required (32 hexadecimal characters).",
    );
  if (!env.CLOUDFLARE_API_TOKEN)
    throw Error("Connect CLOUDFLARE_API_TOKEN through secure settings.");
  const prefix = env.PIXEL_RESOURCE_PREFIX || "pixel-birthday";
  if (!/^[a-z][a-z0-9-]{2,35}$/.test(prefix))
    throw Error("Invalid PIXEL_RESOURCE_PREFIX.");
  if (
    !env.PIXEL_EMAIL_FROM ||
    !/^[^<>]+<[^@<>\s]+@([a-z0-9-]+\.)+[a-z]{2,}>$/i.test(env.PIXEL_EMAIL_FROM)
  )
    throw Error(
      "PIXEL_EMAIL_FROM must use your verified domain: Pixel <contact@your-domain.fr>.",
    );
  if (!env.PIXEL_ADMIN_EMAILS)
    throw Error("Set PIXEL_ADMIN_EMAILS before provisioning.");
  return {
    account,
    token: env.CLOUDFLARE_API_TOKEN,
    name: `${prefix}-${stage}`,
    stage,
    sender: env.PIXEL_EMAIL_FROM,
    admins: env.PIXEL_ADMIN_EMAILS,
    invites: env.PIXEL_PILOT_EMAILS || env.PIXEL_ADMIN_EMAILS,
  };
}
export function client(account, token, transport = fetch) {
  return async (path, method = "GET", body, optional = false) => {
    const response = await transport(
      `https://api.cloudflare.com/client/v4/accounts/${account}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(method === "PUT" && path.endsWith("/lifecycle")
            ? { "cf-r2-data-catalog-check": "true" }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (optional && response.status === 404) return null;
    if (!response.ok)
      throw Error(
        `Cloudflare ${method} ${path.split("?")[0]}: HTTP ${response.status}. Check account permissions and enabled services.`,
      );
    const envelope = await response.json();
    if (envelope.success !== true)
      throw Error(`Cloudflare rejected ${method} ${path.split("?")[0]}.`);
    return envelope;
  };
}
export const originalRule = {
  id: "pixel-delete-originals",
  enabled: true,
  conditions: { prefix: "originals/" },
  deleteObjectsTransition: { condition: { type: "Age", maxAge: 86400 } },
};
export function mergeRules(rules) {
  if (!Array.isArray(rules))
    throw Error(
      "Cannot inspect existing R2 lifecycle rules; refusing to replace them.",
    );
  return [...rules.filter((r) => r.id !== originalRule.id), originalRule];
}
async function findDatabase(api, name) {
  for (let page = 1; page <= 100; page++) {
    const result = await api(`/d1/database?per_page=100&page=${page}`);
    if (!Array.isArray(result.result)) throw Error("Unexpected D1 listing.");
    const matching = result.result.filter((d) => d.name === name);
    if (matching.length > 1) throw Error("Ambiguous D1 database name.");
    if (matching.length) return matching[0];
    const total = result.result_info?.total_pages;
    if (total !== undefined ? page >= total : result.result.length < 100)
      return null;
  }
  throw Error("D1 discovery incomplete.");
}
export async function provision(o, api) {
  // Read the real account namespace; never invent an application URL.
  const sub = (await api("/workers/subdomain")).result?.subdomain;
  if (typeof sub !== "string" || !/^[a-z0-9-]+$/.test(sub))
    throw Error(
      "Activate your Workers workers.dev subdomain in Cloudflare first.",
    );
  let database = await findDatabase(api, o.name);
  if (!database)
    database = (
      await api("/d1/database", "POST", {
        name: o.name,
        primary_location_hint: "weur",
      })
    ).result;
  if (!database?.uuid) throw Error("D1 did not return a database identifier.");
  const bucket = `${o.name}-private`;
  const existing = await api(`/r2/buckets/${bucket}`, "GET", undefined, true);
  if (!existing)
    await api("/r2/buckets", "POST", { name: bucket, locationHint: "weur" });
  const managed = (await api(`/r2/buckets/${bucket}/domains/managed`)).result;
  const custom = (await api(`/r2/buckets/${bucket}/domains/custom`)).result;
  if (
    managed?.enabled !== false ||
    !Array.isArray(custom?.domains) ||
    custom.domains.some((d) => d.enabled !== false)
  )
    throw Error(
      "Bucket privacy cannot be established. Refusing to deploy with public or unknown access.",
    );
  const rules = (await api(`/r2/buckets/${bucket}/lifecycle`)).result?.rules;
  const merged = mergeRules(rules);
  if (JSON.stringify(rules) !== JSON.stringify(merged))
    await api(`/r2/buckets/${bucket}/lifecycle`, "PUT", { rules: merged });
  const queue = `${o.name}-generations`,
    queues = (await api(`/queues?name=${encodeURIComponent(queue)}`)).result;
  if (!Array.isArray(queues)) throw Error("Unexpected queue listing.");
  if (!queues.some((q) => q.queue_name === queue))
    await api("/queues", "POST", {
      queue_name: queue,
      settings: { message_retention_period: 86400 },
    });
  const url = `https://${o.name}.${sub}.workers.dev`;
  const config = {
    name: o.name,
    account_id: o.account,
    main: "platform/worker/index.ts",
    compatibility_date: "2026-10-01",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: true,
    assets: {
      directory: "./dist",
      binding: "ASSETS",
      not_found_handling: "single-page-application",
      run_worker_first: ["/api/*"],
    },
    vars: {
      APP_MODE: o.stage,
      APP_URL: url,
      EMAIL_FROM: o.sender,
      ADMIN_EMAILS: o.admins,
      PILOT_EMAILS: o.invites,
      SALES_ENABLED: "false",
      LEGAL_READY: "false",
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: o.name,
        database_id: database.uuid,
        migrations_dir: "platform/migrations",
      },
    ],
    r2_buckets: [{ binding: "FILES", bucket_name: bucket }],
    queues: {
      producers: [{ binding: "GENERATIONS", queue }],
      consumers: [{ queue, max_batch_size: 1, max_retries: 0 }],
    },
    triggers: { crons: ["0 * * * *"] },
  };
  return config;
}
async function main() {
  const stage =
    process.argv.find((a) => a.startsWith("--stage="))?.split("=")[1] ||
    "pilot";
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify(
        {
          mode: "plan",
          stage,
          resources: [
            "D1 database",
            "private R2 bucket",
            "24-hour original retention",
            "generation queue",
            "Worker assets/API",
            "hourly cleanup",
          ],
          changes:
            "No remote requests or changes. Use --apply only with the account credentials and sender configured.",
        },
        null,
        2,
      ),
    );
    return;
  }
  const o = optionsFrom(process.env, stage);
  const config = await provision(o, client(o.account, o.token));
  await writeFile(
    "wrangler.deploy.json",
    JSON.stringify(config, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      stage,
      worker: config.name,
      url: config.vars.APP_URL,
      config: "wrangler.deploy.json",
      sales: false,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error("Provisioning stopped: " + error.message);
    process.exitCode = 1;
  });
