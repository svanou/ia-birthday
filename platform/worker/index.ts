import { bodyLimit } from "hono/body-limit";
import { reservationSQL } from "./quota";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import Stripe from "stripe";
import { auth, hash, token } from "./auth";
import {
  DAY,
  HOURS,
  THEMES,
  sixMonths,
  phase,
  canGenerate,
  isLocal,
  allowed,
  type Party,
} from "./domain";
import { processJob, story } from "./generation";
import type { Env } from "./types";
const app = new Hono<{
  Bindings: Env;
  Variables: { email: string; device: { party: string; role: string } | null };
}>();
const jsonBody = async <S extends z.ZodType>(
  c: any,
  s: S,
): Promise<z.output<S>> => s.parse(await c.req.json());
const partyInput = z
  .object({
    theme: z.enum(THEMES),
    names: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(24)
          .regex(/^[\p{L}\p{N} '-]+$/u),
      )
      .min(1)
      .max(10),
  })
  .refine(
    (v) => new Set(v.names.map((n) => n.toLowerCase())).size === v.names.length,
    "Pseudonymes distincts requis",
  );
const stripe = (e: Env) =>
  new Stripe(e.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
const q = (e: Env, sql: string, ...args: any[]) =>
  e.DB.prepare(sql).bind(...args);
const cookieOptions = (url: string, maxAge: number) => ({
  httpOnly: true,
  secure: new URL(url).protocol === "https:",
  sameSite: "Strict" as const,
  path: "/",
  maxAge,
});
async function grant(e: Env, email: string, payment: string | null) {
  const now = Date.now(),
    id = crypto.randomUUID();
  await q(
    e,
    "INSERT OR IGNORE INTO parties(id,owner,purchased_at,activate_by,retain_until,payment_id) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM refunded_payments WHERE payment_id=?)",
    id,
    email,
    now,
    sixMonths(now),
    sixMonths(now) + 30 * DAY,
    payment,
    payment,
  ).run();
  return id;
}
async function owned(c: any, write = false): Promise<Party> {
  const p = (await q(
    c.env,
    "SELECT * FROM parties WHERE id=?",
    c.req.param("id"),
  ).first()) as Party | null;
  const d = c.get("device");
  if (
    !p ||
    (p.owner !== c.get("email") &&
      (!d || d.party !== p.id || (write && d.role !== "control")))
  )
    throw new Error("NOT_FOUND");
  if (["revoked", "deleted"].includes(phase(p)))
    throw new Error("ACCESS_ENDED");
  return p;
}
app.onError((err, c) => {
  const message =
    err instanceof z.ZodError
      ? "Champs invalides. Vérifiez votre saisie."
      : err.message;
  const codes: Record<string, number> = {
    NOT_FOUND: 404,
    ACCESS_ENDED: 403,
    AUTH_UNCONFIGURED: 503,
    EMAIL_UNAVAILABLE: 503,
  };
  return c.json(
    {
      error: codes[message]
        ? message
        : err instanceof z.ZodError
          ? message
          : "La demande n’a pas pu aboutir. Réessayez ou contactez le support.",
    },
    (codes[message] || 400) as any,
  );
});
app.use("/api/*", async (c, next) =>
  bodyLimit({
    maxSize: c.req.path.endsWith("/upload") ? 4_100_000 : 65536,
    onError: (ctx) => ctx.json({ error: "Requête trop volumineuse." }, 413),
  })(c, next),
);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  if (c.env.APP_MODE === "local" && !isLocal(c.env.APP_MODE, c.req.url))
    return c.json({ error: "LOCAL_MODE_DISABLED" }, 503);
  if (
    !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
    !c.req.path.startsWith("/api/stripe/webhook")
  ) {
    const origin = c.req.header("Origin");
    if (
      origin &&
      origin !== c.env.APP_URL &&
      !(
        isLocal(c.env.APP_MODE, c.req.url) &&
        [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:8787",
        ].includes(origin)
      )
    )
      return c.json({ error: "ORIGIN_DENIED" }, 403);
  }
  await next();
});
app.get("/api/config", (c) =>
  c.json({
    mode: c.env.APP_MODE,
    price: 39,
    authReady: !!(c.env.BETTER_AUTH_SECRET && c.env.RESEND_API_KEY),
    sales:
      c.env.SALES_ENABLED === "true" &&
      c.env.LEGAL_READY === "true" &&
      c.env.APP_MODE === "live",
  }),
);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth(c.env).handler(c.req.raw));
app.post("/api/local/login", async (c) => {
  if (!isLocal(c.env.APP_MODE, c.req.url)) return c.notFound();
  const { email } = await jsonBody(
    c,
    z.object({
      email: z
        .string()
        .email()
        .transform((s) => s.toLowerCase()),
    }),
  );
  const t = token();
  await q(
    c.env,
    "INSERT INTO local_sessions VALUES(?,?,?)",
    await hash(t),
    email,
    Date.now() + DAY,
  ).run();
  setCookie(c, "pixel_local", t, cookieOptions(c.req.url, 86400));
  return c.json({ ok: true });
});
app.post("/api/stripe/webhook", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET || !c.env.STRIPE_SECRET_KEY)
    return c.json({ error: "PAYMENT_UNCONFIGURED" }, 503);
  let event: Stripe.Event;
  try {
    event = await stripe(c.env).webhooks.constructEventAsync(
      await c.req.text(),
      c.req.header("stripe-signature") || "",
      c.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return c.json({ error: "SIGNATURE_INVALID" }, 400);
  }
  if (event.livemode !== (c.env.APP_MODE === "live"))
    return c.json({ error: "MODE_MISMATCH" }, 400);
  if (await q(c.env, "SELECT id FROM events WHERE id=?", event.id).first())
    return c.json({ ok: true });
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    const order = await q(
      c.env,
      "SELECT * FROM orders WHERE id=?",
      s.metadata?.order || "",
    ).first<any>();
    if (!order || s.amount_total !== 3900 || s.currency !== "eur")
      return c.json({ error: "ORDER_INVALID" }, 400);
    if (s.payment_status !== "paid") return c.json({ ok: true });
    if (typeof s.payment_intent !== "string")
      return c.json({ error: "PAYMENT_INVALID" }, 400);
    await grant(c.env, order.owner, String(s.payment_intent));
    await q(
      c.env,
      "UPDATE orders SET status='paid' WHERE id=?",
      order.id,
    ).run();
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.refunded && typeof charge.payment_intent === "string") {
      await c.env.DB.batch([
        q(
          c.env,
          "INSERT OR IGNORE INTO refunded_payments VALUES(?,?)",
          charge.payment_intent,
          Date.now(),
        ),
        q(
          c.env,
          "UPDATE parties SET status='revoked' WHERE payment_id=?",
          charge.payment_intent,
        ),
      ]);
    }
  }
  await q(
    c.env,
    "INSERT OR IGNORE INTO events VALUES(?,?)",
    event.id,
    Date.now(),
  ).run();
  return c.json({ ok: true });
});
app.post("/api/pair", async (c) => {
  const { code } = await jsonBody(
    c,
    z.object({ code: z.string().min(32).max(200) }),
  );
  const record = await q(
    c.env,
    "DELETE FROM pairings WHERE hash=? AND expires_at>? RETURNING *",
    await hash(code),
    Date.now(),
  ).first<any>();
  if (!record)
    return c.json(
      {
        error:
          "Lien expiré ou déjà utilisé. Recréez-le depuis votre espace parent.",
      },
      403,
    );
  const p = await q(
    c.env,
    "SELECT * FROM parties WHERE id=? AND status!='revoked' AND retain_until>?",
    record.party,
    Date.now(),
  ).first<Party>();
  if (!p) return c.json({ error: "SESSION_UNAVAILABLE" }, 403);
  const t = token();
  await q(
    c.env,
    "INSERT INTO devices VALUES(?,?,?,?)",
    await hash(t),
    p.id,
    record.role,
    p.ends_at || Date.now() + HOURS,
  ).run();
  setCookie(
    c,
    "pixel_device",
    t,
    cookieOptions(
      c.req.url,
      Math.ceil(((p.ends_at || Date.now() + HOURS) - Date.now()) / 1000),
    ),
  );
  return c.json({ party: p.id, role: record.role });
});
app.use("/api/*", async (c, next) => {
  let email = "";
  c.set("device", null);
  if (isLocal(c.env.APP_MODE, c.req.url)) {
    const local = getCookie(c, "pixel_local");
    if (local) {
      const s = await q(
        c.env,
        "SELECT email FROM local_sessions WHERE hash=? AND expires_at>?",
        await hash(local),
        Date.now(),
      ).first<{ email: string }>();
      email = s?.email || "";
    }
  } else if (c.env.BETTER_AUTH_SECRET && c.env.RESEND_API_KEY) {
    const s = await auth(c.env).api.getSession({ headers: c.req.raw.headers });
    email = s?.user.email.toLowerCase() || "";
  }
  const device = getCookie(c, "pixel_device");
  if (device) {
    const d = await q(
      c.env,
      "SELECT party,role FROM devices WHERE hash=? AND expires_at>?",
      await hash(device),
      Date.now(),
    ).first<{ party: string; role: string }>();
    c.set("device", d);
  }
  if (!email && !c.get("device"))
    return c.json({ error: "Connexion requise." }, 401);
  if (
    email &&
    c.env.APP_MODE === "pilot" &&
    !allowed(email, c.env.PILOT_EMAILS) &&
    !allowed(email, c.env.ADMIN_EMAILS)
  )
    return c.json({ error: "Le pilote est accessible sur invitation." }, 403);
  c.set("email", email);
  await next();
});
app.post("/api/logout", async (c) => {
  if (!isLocal(c.env.APP_MODE, c.req.url) && c.get("email"))
    await auth(c.env).api.signOut({ headers: c.req.raw.headers });
  for (const name of ["pixel_local", "pixel_device"]) {
    const value = getCookie(c, name);
    if (value)
      await q(
        c.env,
        `DELETE FROM ${name === "pixel_local" ? "local_sessions" : "devices"} WHERE hash=?`,
        await hash(value),
      ).run();
    setCookie(c, name, "", cookieOptions(c.req.url, 0));
  }
  return c.json({ ok: true });
});
app.get("/api/me", (c) =>
  c.json({
    email: c.get("email"),
    device: c.get("device"),
    admin: !!c.get("email") && allowed(c.get("email"), c.env.ADMIN_EMAILS),
  }),
);
app.get("/api/parties", async (c) => {
  if (!c.get("email")) return c.json([], 200);
  const rows = await q(
    c.env,
    "SELECT * FROM parties WHERE owner=? AND status!='revoked' AND retain_until>? ORDER BY purchased_at DESC",
    c.get("email"),
    Date.now(),
  ).all<Party>();
  return c.json(rows.results.map((p) => ({ ...p, phase: phase(p) })));
});
app.post("/api/local/party", async (c) => {
  if (!isLocal(c.env.APP_MODE, c.req.url) || !c.get("email"))
    return c.notFound();
  return c.json({ id: await grant(c.env, c.get("email"), null) });
});
app.post("/api/checkout", async (c) => {
  if (!c.get("email"))
    return c.json({ error: "Connexion parent requise" }, 403);
  if (c.env.APP_MODE === "local")
    return c.json({ error: "Utilisez le forfait de simulation." }, 400);
  if (
    !c.env.STRIPE_SECRET_KEY ||
    (c.env.APP_MODE === "live" &&
      (c.env.SALES_ENABLED !== "true" || c.env.LEGAL_READY !== "true"))
  )
    return c.json({ error: "Les ventes ne sont pas encore ouvertes." }, 503);
  if (
    (c.env.APP_MODE === "live") !==
    c.env.STRIPE_SECRET_KEY.startsWith("sk_live_")
  )
    return c.json({ error: "Configuration du paiement incohérente." }, 503);
  const order = crypto.randomUUID();
  await q(
    c.env,
    "INSERT INTO orders(id,owner,created_at) VALUES(?,?,?)",
    order,
    c.get("email"),
    Date.now(),
  ).run();
  const s = await stripe(c.env).checkout.sessions.create(
    {
      mode: "payment",
      customer_email: c.get("email"),
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: 3900,
            product_data: {
              name: "Pixel — une fête de 4 heures, jusqu’à 10 enfants",
            },
          },
          quantity: 1,
        },
      ],
      metadata: { order },
      success_url: c.env.APP_URL + "/?payment=success",
      cancel_url: c.env.APP_URL + "/?payment=cancel",
    },
    { idempotencyKey: order },
  );
  return c.json({ url: s.url });
});
app.get("/api/parties/:id", async (c) => {
  const p = await owned(c);
  const jobs = await q(
    c.env,
    "SELECT id,kind,alias,status,approved,error,model FROM jobs WHERE party=? ORDER BY created_at",
    p.id,
  ).all<any>();
  const display = c.get("device")?.role === "display";
  const visible = display
    ? jobs.results.filter((j) => j.approved)
    : jobs.results;
  return c.json({
    ...p,
    owner: undefined,
    payment_id: undefined,
    names: JSON.parse(p.names),
    phase: phase(p),
    now: Date.now(),
    story:
      display && !p.story_approved
        ? null
        : p.story
          ? JSON.parse(p.story)
          : null,
    jobs: visible,
    credits:
      20 -
      jobs.results.filter((j) => j.kind === "image" && j.status !== "failed")
        .length,
    trialAvailable: !jobs.results.some(
      (j) => j.kind === "trial" && j.status !== "failed",
    ),
  });
});
app.put("/api/parties/:id", async (c) => {
  const p = await owned(c, true);
  if (phase(p) !== "preparation")
    return c.json(
      { error: "La préparation est verrouillée après activation." },
      409,
    );
  const input = await jsonBody(c, partyInput);
  await q(
    c.env,
    "UPDATE parties SET theme=?,names=? WHERE id=? AND activated_at IS NULL",
    input.theme,
    JSON.stringify(input.names),
    p.id,
  ).run();
  return c.json({ ok: true });
});
app.post("/api/parties/:id/activate", async (c) => {
  const p = await owned(c, true);
  await jsonBody(c, z.object({ confirm: z.literal(true) }));
  if (!JSON.parse(p.names).length)
    return c.json(
      {
        error: "Ajoutez au moins un pseudonyme et enregistrez la préparation.",
      },
      400,
    );
  const now = Date.now();
  const r = await q(
    c.env,
    "UPDATE parties SET activated_at=?,ends_at=?,retain_until=? WHERE id=? AND activated_at IS NULL AND activate_by>? AND status='paid'",
    now,
    now + HOURS,
    now + HOURS + 30 * DAY,
    p.id,
    now,
  ).run();
  if (!r.meta.changes)
    return c.json(
      { error: "Cette session est déjà activée ou a expiré." },
      409,
    );
  return c.json({ ok: true });
});
app.post("/api/parties/:id/pair", async (c) => {
  const p = await owned(c, true);
  if (p.owner !== c.get("email"))
    return c.json({ error: "Compte parent requis" }, 403);
  const { role } = await jsonBody(
    c,
    z.object({ role: z.enum(["control", "display"]) }),
  );
  if (!["preparation", "active"].includes(phase(p)))
    return c.json({ error: "SESSION_ENDED" }, 403);
  const t = token();
  await q(
    c.env,
    "INSERT INTO pairings VALUES(?,?,?,?)",
    await hash(t),
    p.id,
    role,
    Date.now() + 10 * 60000,
  ).run();
  return c.json({ url: c.env.APP_URL + "/#pair=" + t });
});
app.post("/api/parties/:id/step", async (c) => {
  const p = await owned(c, true);
  if (phase(p) !== "active") return c.json({ error: "SESSION_ENDED" }, 403);
  const { step } = await jsonBody(
    c,
    z.object({ step: z.number().int().min(0).max(4) }),
  );
  await q(c.env, "UPDATE parties SET step=? WHERE id=?", step, p.id).run();
  return c.json({ ok: true });
});
app.post("/api/parties/:id/story", async (c) => {
  const p = await owned(c, true);
  if (phase(p) !== "active") return c.json({ error: "SESSION_ENDED" }, 403);
  // Claim once before the provider call: no repeated text spending on retries.
  const claim = await q(
    c.env,
    "UPDATE parties SET story=? WHERE id=? AND story IS NULL",
    JSON.stringify([]),
    p.id,
  ).run();
  if (!claim.meta.changes) return c.json({ ok: true });
  let scenes;
  try {
    scenes = await story(c.env, p, isLocal(c.env.APP_MODE, c.req.url));
  } catch {
    const { fallbackStory } = await import("../src/content");
    scenes = fallbackStory(p.theme as any, JSON.parse(p.names));
  }
  await q(
    c.env,
    "UPDATE parties SET story=? WHERE id=?",
    JSON.stringify(scenes),
    p.id,
  ).run();
  return c.json({ ok: true });
});
app.post("/api/parties/:id/approve", async (c) => {
  const p = await owned(c, true);
  if (!["active", "gallery"].includes(phase(p)))
    return c.json({ error: "SESSION_UNAVAILABLE" }, 403);
  const { job, approved } = await jsonBody(
    c,
    z.object({ job: z.string(), approved: z.boolean() }),
  );
  if (job === "story")
    await q(
      c.env,
      "UPDATE parties SET story_approved=? WHERE id=?",
      +approved,
      p.id,
    ).run();
  else
    await q(
      c.env,
      "UPDATE jobs SET approved=? WHERE id=? AND party=? AND status='done'",
      +approved,
      job,
      p.id,
    ).run();
  return c.json({ ok: true });
});
app.post("/api/parties/:id/upload", async (c) => {
  const p = await owned(c, true);
  if (!["preparation", "active"].includes(phase(p)))
    return c.json({ error: "SESSION_ENDED" }, 403);
  if (Number(c.req.header("content-length") || 0) > 5_000_000)
    return c.json({ error: "Image trop volumineuse (4 Mo maximum)." }, 413);
  const count = await q(
    c.env,
    "SELECT COUNT(*) n FROM uploads WHERE party=?",
    p.id,
  ).first<{ n: number }>();
  if ((count?.n || 0) >= 3)
    return c.json(
      { error: "Terminez les créations en attente avant de continuer." },
      429,
    );
  const form = await c.req.formData();
  const file = form.get("image");
  if (
    !(file instanceof File) ||
    file.size > 4_000_000 ||
    file.size === 0 ||
    !["image/png", "image/jpeg"].includes(file.type)
  )
    return c.json(
      {
        error: "Choisissez un dessin au format JPEG ou PNG, de moins de 4 Mo.",
      },
      400,
    );
  const bytes = await file.arrayBuffer(),
    head = new Uint8Array(bytes);
  if (!(
    (file.type === "image/png" &&
      head[0] === 137 &&
      head[1] === 80 &&
      head[2] === 78) ||
    (file.type === "image/jpeg" && head[0] === 255 && head[1] === 216)
  ))
    return c.json({ error: "Format invalide" }, 400);
  const id = crypto.randomUUID(),
    key = `originals/${p.id}/${id}`;
  await c.env.FILES.put(key, bytes, {
    httpMetadata: { contentType: file.type },
  });
  try {
    await q(
      c.env,
      "INSERT INTO uploads VALUES(?,?,?,?,?)",
      id,
      p.id,
      key,
      file.type,
      Date.now(),
    ).run();
  } catch (e) {
    await c.env.FILES.delete(key);
    throw e;
  }
  return c.json({ id });
});
app.post("/api/parties/:id/generate", async (c) => {
  const p = await owned(c, true);
  const input = await jsonBody(
    c,
    z.object({
      id: z.string().uuid(),
      upload: z.string().uuid(),
      alias: z.string().min(1).max(24),
      kind: z.enum(["trial", "image"]),
    }),
  );
  if (!canGenerate(p, input.kind))
    return c.json(
      { error: "La génération n’est pas disponible à cette étape." },
      403,
    );
  if (!JSON.parse(p.names).includes(input.alias))
    return c.json({ error: "Choisissez un pseudonyme enregistré." }, 400);
  if (
    await q(
      c.env,
      "SELECT id FROM jobs WHERE id=? AND party=?",
      input.id,
      p.id,
    ).first()
  )
    return c.json({ id: input.id });
  if (
    !(await q(
      c.env,
      "SELECT id FROM uploads WHERE id=? AND party=?",
      input.upload,
      p.id,
    ).first())
  )
    return c.json(
      { error: "Dessin introuvable. Importez-le de nouveau." },
      400,
    );
  const max = input.kind === "trial" ? 1 : 20,
    now = Date.now();
  const r = await q(
    c.env,
    reservationSQL(input.kind),
    input.id,
    p.id,
    input.kind,
    input.alias,
    input.upload,
    now,
    p.id,
    input.kind,
    max,
    p.id,
    p.id,
    now - 3600000,
    p.id,
    now,
  ).run();
  if (!r.meta.changes)
    return c.json(
      {
        error:
          "Crédits épuisés, dessin déjà utilisé ou deux créations en cours. Patientez avant de réessayer.",
      },
      409,
    );
  try {
    await c.env.GENERATIONS.send({ id: input.id });
  } catch {
    await q(
      c.env,
      "UPDATE jobs SET status='failed',error='QUEUE_UNAVAILABLE',finished_at=? WHERE id=? AND status='queued'",
      Date.now(),
      input.id,
    ).run();
    return c.json(
      { error: "Service temporairement indisponible. Aucun crédit consommé." },
      503,
    );
  }
  return c.json({ id: input.id }, 202);
});
app.get("/api/parties/:id/images/:job", async (c) => {
  const p = await owned(c);
  const display = c.get("device")?.role === "display";
  const j = await q(
    c.env,
    "SELECT object_key,approved FROM jobs WHERE id=? AND party=? AND status='done'",
    c.req.param("job"),
    p.id,
  ).first<any>();
  if (!j || (display && !j.approved)) return c.notFound();
  const object = await c.env.FILES.get(j.object_key);
  if (!object) return c.notFound();
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
app.get("/api/admin/parties", async (c) => {
  if (!allowed(c.get("email"), c.env.ADMIN_EMAILS))
    return c.json({ error: "FORBIDDEN" }, 403);
  const rows = await q(
    c.env,
    "SELECT * FROM parties WHERE owner LIKE ? ORDER BY purchased_at DESC LIMIT 50",
    "%" + (c.req.query("q") || "").slice(0, 100) + "%",
  ).all();
  return c.json(rows.results);
});
app.post("/api/admin/parties/:id", async (c) => {
  if (!allowed(c.get("email"), c.env.ADMIN_EMAILS))
    return c.json({ error: "FORBIDDEN" }, 403);
  const { action, reason, hours } = await jsonBody(
    c,
    z.object({
      action: z.enum(["extend", "revoke"]),
      reason: z.string().trim().min(10).max(500),
      hours: z.number().int().min(1).max(24).optional(),
    }),
  );
  if (action === "extend" && !hours)
    return c.json({ error: "Durée requise" }, 400);
  const now = Date.now();
  await c.env.DB.batch([
    action === "revoke"
      ? q(
          c.env,
          "UPDATE parties SET status='revoked' WHERE id=?",
          c.req.param("id"),
        )
      : q(
          c.env,
          "UPDATE parties SET ends_at=MAX(ends_at,?)+?,retain_until=MAX(ends_at,?)+?+? WHERE id=? AND ends_at IS NOT NULL AND status!='revoked' AND retain_until>?",
          now,
          hours! * 3600000,
          now,
          hours! * 3600000,
          30 * DAY,
          c.req.param("id"),
          now,
        ),
    q(
      c.env,
      "INSERT INTO audit VALUES(?,?,?,?,?,?)",
      crypto.randomUUID(),
      c.get("email"),
      c.req.param("id"),
      action,
      reason,
      now,
    ),
  ]);
  return c.json({ ok: true });
});
app.all("/api/*", (c) => c.json({ error: "NOT_FOUND" }, 404));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
export async function cleanup(e: Env) {
  const now = Date.now();
  await q(
    e,
    "UPDATE jobs SET status='failed',error='INTERRUPTED',finished_at=? WHERE status IN ('queued','running') AND created_at<?",
    now,
    now - 10 * 60000,
  ).run();
  const uploads = await q(
    e,
    "SELECT * FROM uploads WHERE created_at<?",
    now - DAY,
  ).all<any>();
  for (const u of uploads.results) {
    await e.FILES.delete(u.object_key);
    await q(e, "DELETE FROM uploads WHERE id=?", u.id).run();
  }
  const parties = await q(
    e,
    "SELECT id FROM parties WHERE retain_until<?",
    now,
  ).all<{ id: string }>();
  for (const p of parties.results) {
    const jobs = await q(
      e,
      "SELECT object_key FROM jobs WHERE party=?",
      p.id,
    ).all<any>();
    for (const j of jobs.results)
      if (j.object_key) await e.FILES.delete(j.object_key);
    await e.DB.batch([
      q(e, "DELETE FROM jobs WHERE party=?", p.id),
      q(e, "UPDATE parties SET names='[]',story=NULL WHERE id=?", p.id),
    ]);
  }
  await e.DB.batch([
    q(e, "DELETE FROM pairings WHERE expires_at<?", now),
    q(e, "DELETE FROM devices WHERE expires_at<?", now),
    q(e, "DELETE FROM local_sessions WHERE expires_at<?", now),
  ]);
}
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<{ id: string }>, e: Env) {
    for (const m of batch.messages) {
      await processJob(e, m.body.id);
      m.ack();
    }
  },
  async scheduled(_event: ScheduledController, e: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanup(e));
  },
};
