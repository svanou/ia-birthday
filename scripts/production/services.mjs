import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import Stripe from "stripe";
import { client } from "./provision.mjs";

// Raw provider secrets are entered by the owner in GitHub Actions, never copied
// from proxy placeholders in a Codex execution environment.
async function main() {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw Error(
      "Run this step in the deployment workflow with GitHub Secrets.",
    );
  const c = JSON.parse(await readFile("wrangler.deploy.json", "utf8"));
  const env = process.env,
    stage = c.vars.APP_MODE;
  for (const name of [
    "CLOUDFLARE_API_TOKEN",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "OPENAI_KEY",
  ])
    if (!env[name]) throw Error(`Missing GitHub secret: ${name}.`);
  if (
    !env.STRIPE_SECRET_KEY.startsWith(
      stage === "live" ? "sk_live_" : "sk_test_",
    )
  )
    throw Error("Stripe key does not match the selected stage.");
  const domain = c.vars.EMAIL_FROM.match(/@([^>]+)>$/)?.[1]?.toLowerCase();
  if (!domain || ["gmail.com", "outlook.com", "example.com"].includes(domain))
    throw Error("Use a domain you own and can verify.");
  const resend = async (path, method = "GET", body) => {
    const r = await fetch("https://api.resend.com" + path, {
      method,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error(`Resend ${method} ${path}: HTTP ${r.status}.`);
    return r.json();
  };
  // Do not guess DNS ownership or overwrite existing DNS records.
  let match;
  let after;
  for (let page = 0; page < 100; page++) {
    const list = await resend(
      "/domains?limit=100" +
        (after ? "&after=" + encodeURIComponent(after) : ""),
    );
    if (!Array.isArray(list.data))
      throw Error("Cannot inspect Resend domains.");
    match = list.data.find((d) => d.name === domain);
    if (match || !list.has_more) break;
    after = list.data.at(-1)?.id;
    if (!after) throw Error("Incomplete Resend domain listing.");
    if (page === 99) throw Error("Incomplete Resend domain listing.");
  }
  if (!match) {
    const created = await resend("/domains", "POST", {
      name: domain,
      region: "eu-west-1",
    });
    if (!created.id) throw Error("Resend did not return a domain ID.");
    match = { id: created.id };
  }
  const details = await resend("/domains/" + encodeURIComponent(match.id));
  if (details.status !== "verified") {
    console.log(
      "Domain DNS verification required. These DNS records are public, not credentials:",
    );
    console.log(
      JSON.stringify(
        {
          domain,
          records: details.records?.map((r) => ({
            name: r.name,
            type: r.type,
            value: r.value,
            priority: r.priority,
          })),
        },
        null,
        2,
      ),
    );
    throw Error(
      "Verify these records at the domain DNS provider, then rerun the workflow. No email was sent.",
    );
  }
  for (const model of [
    "gpt-image-1-mini",
    "gpt-4.1-mini",
    "omni-moderation-latest",
  ]) {
    const r = await fetch("https://api.openai.com/v1/models/" + model, {
      headers: { Authorization: `Bearer ${env.OPENAI_KEY}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok)
      throw Error(
        `OpenAI model access check failed for ${model} (HTTP ${r.status}). No generation was attempted.`,
      );
  }
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const api = client(c.account_id, env.CLOUDFLARE_API_TOKEN);
  const route = `/workers/scripts/${c.name}/secrets`;
  const existing = (await api(route)).result;
  if (!Array.isArray(existing))
    throw Error("Cannot inspect Worker secret names.");
  const put = (name, text) =>
    api(route, "PUT", { name, text, type: "secret_text" });
  const wantedURL = c.vars.APP_URL + "/api/stripe/webhook";
  let hook;
  for await (const h of stripe.webhookEndpoints.list({ limit: 100 }))
    if (h.url === wantedURL) {
      if (hook)
        throw Error(
          "Multiple Stripe webhooks match this URL; review them manually.",
        );
      hook = h;
    }
  let signature;
  const events = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "charge.refunded",
  ];
  if (hook) {
    if (
      hook.metadata?.pixel_worker !== c.name ||
      hook.status !== "enabled" ||
      !events.every(
        (e) =>
          hook.enabled_events.includes(e) || hook.enabled_events.includes("*"),
      )
    )
      throw Error(
        "Existing webhook is not managed by this deployment or has different settings.",
      );
    signature = env.STRIPE_WEBHOOK_SECRET;
    if (!signature && !existing.some((s) => s.name === "STRIPE_WEBHOOK_SECRET"))
      throw Error(
        "Webhook already exists. Enter its signing secret in the stage GitHub Secrets to recover configuration; it is not readable through Stripe.",
      );
  } else {
    hook = await stripe.webhookEndpoints.create(
      {
        url: wantedURL,
        enabled_events: events,
        metadata: { pixel_worker: c.name },
      },
      {
        idempotencyKey:
          "pixel-webhook-" +
          createHash("sha256").update(wantedURL).digest("hex"),
      },
    );
    signature = hook.secret;
    if (!signature) throw Error("Stripe signing secret missing.");
  }
  if (signature) await put("STRIPE_WEBHOOK_SECRET", signature);
  if (!existing.some((s) => s.name === "BETTER_AUTH_SECRET"))
    await put("BETTER_AUTH_SECRET", randomBytes(48).toString("hex"));
  await put("STRIPE_SECRET_KEY", env.STRIPE_SECRET_KEY);
  await put("OPENAI_KEY", env.OPENAI_KEY);
  await put("RESEND_API_KEY", env.RESEND_API_KEY);
  console.log(
    JSON.stringify({
      worker: c.name,
      webhook_id: hook.id,
      domain_verified: true,
      models_accessible: true,
      sales_open: false,
    }),
  );
}
main().catch((error) => {
  console.error(
    error instanceof Stripe.errors.StripeError
      ? "Stripe configuration failed; check permissions and account setup."
      : error.message,
  );
  process.exitCode = 1;
});
