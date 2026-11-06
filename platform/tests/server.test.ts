import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, it, expect } from "vitest";
import Stripe from "stripe";
import worker, { cleanup } from "../worker/index";
import { processJob } from "../worker/generation";
import type { Env } from "../worker/types";
let db: DatabaseSync, env: Env, objects: Map<string, ArrayBuffer>;
function statement(sql: string, args: any[] = []): any {
  return {
    bind: (...a: any[]) => statement(sql, a),
    run: async () => ({
      meta: { changes: Number(db.prepare(sql).run(...args).changes) },
    }),
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  };
}
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec(readFileSync("platform/migrations/0001.sql", "utf8"));
  db.exec(readFileSync("platform/migrations/0002.sql", "utf8"));
  objects = new Map();
  env = {
    APP_MODE: "pilot",
    APP_URL: "https://pixel.example",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    DB: {
      prepare: statement,
      batch: async (s: any[]) => {
        db.exec("BEGIN");
        try {
          const result = [];
          for (const x of s) result.push(await x.run());
          db.exec("COMMIT");
          return result;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    FILES: {
      get: async (k: string) =>
        objects.has(k)
          ? {
              arrayBuffer: async () => objects.get(k),
              httpMetadata: { contentType: "image/png" },
            }
          : null,
      put: async (k: string, v: ArrayBuffer) => objects.set(k, v),
      delete: async (k: string) => objects.delete(k),
    },
  } as unknown as Env;
  db.prepare("INSERT INTO orders(id,owner,created_at) VALUES(?,?,?)").run(
    "order1",
    "parent@example.com",
    Date.now(),
  );
});
afterEach(() => db.close());
async function webhook(
  id: string,
  obj: any,
  type = "checkout.session.completed",
  valid = true,
  live = false,
) {
  const payload = JSON.stringify({
    id,
    type,
    livemode: live,
    data: { object: obj },
  });
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret: valid ? "whsec_fixture" : "wrong",
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
  return worker.fetch(
    new Request("https://pixel.example/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signature },
    }) as any,
    env,
    {} as any,
  );
}
const paid = {
  metadata: { order: "order1" },
  amount_total: 3900,
  currency: "eur",
  payment_status: "paid",
  payment_intent: "pi_one",
};
it("ne délivre un forfait qu’une fois malgré plusieurs événements de paiement", async () => {
  expect((await webhook("evt_1", paid)).status).toBe(200);
  expect((await webhook("evt_1", paid)).status).toBe(200);
  expect((await webhook("evt_2", paid)).status).toBe(200);
  expect(db.prepare("SELECT count(*) n FROM parties").get()?.n).toBe(1);
});
it("refuse signature invalide, montant altéré et événement live dans le pilote", async () => {
  expect((await webhook("evt_1", paid, undefined, false)).status).toBe(400);
  expect((await webhook("evt_2", { ...paid, amount_total: 1 })).status).toBe(
    400,
  );
  expect((await webhook("evt_3", paid, undefined, true, true)).status).toBe(
    400,
  );
  expect(db.prepare("SELECT count(*) n FROM parties").get()?.n).toBe(0);
});
it("une redirection ou un paiement non confirmé ne délivre pas de forfait", async () => {
  await webhook("evt_pending", { ...paid, payment_status: "unpaid" });
  expect(db.prepare("SELECT count(*) n FROM parties").get()?.n).toBe(0);
});
it("un remboursement complet révoque la session, sans modifier le comportement du partiel", async () => {
  await webhook("evt_paid", paid);
  await webhook(
    "evt_partial",
    { payment_intent: "pi_one", refunded: false },
    "charge.refunded",
  );
  expect(db.prepare("SELECT status FROM parties").get()?.status).toBe("paid");
  await webhook(
    "evt_full",
    { payment_intent: "pi_one", refunded: true },
    "charge.refunded",
  );
  expect(db.prepare("SELECT status FROM parties").get()?.status).toBe(
    "revoked",
  );
});
it("un doublon Queue ne refait pas une génération terminée ; l’original est supprimé", async () => {
  await webhook("evt_paid", paid);
  const p = db.prepare("SELECT id FROM parties").get()!.id;
  env.APP_MODE = "local";
  objects.set("source", new Uint8Array([1, 2, 3]).buffer);
  db.prepare("INSERT INTO uploads VALUES(?,?,?,?,?)").run(
    "u",
    p,
    "source",
    "image/png",
    Date.now(),
  );
  db.prepare(
    "INSERT INTO jobs(id,party,kind,alias,upload,status,created_at) VALUES('j',?,'trial','Luna','u','queued',?)",
  ).run(p, Date.now());
  await processJob(env, "j");
  expect(db.prepare("SELECT status FROM jobs WHERE id='j'").get()?.status).toBe(
    "done",
  );
  expect(objects.has("source")).toBe(false);
  const count = objects.size;
  await processJob(env, "j");
  expect(objects.size).toBe(count);
});
it("le nettoyage supprime les objets et le récit, et libère les travaux bloqués", async () => {
  await webhook("evt_paid", paid);
  const p = db.prepare("SELECT id FROM parties").get()!.id;
  db.prepare(
    "UPDATE parties SET retain_until=?,names='[\"Luna\"]',story='[\"Histoire\"]'",
  ).run(Date.now() - 1);
  objects.set("result", new ArrayBuffer(1));
  db.prepare(
    "INSERT INTO jobs(id,party,kind,alias,upload,status,created_at,object_key) VALUES('j',?,'image','Luna','u','done',?,'result')",
  ).run(p, Date.now());
  await cleanup(env);
  expect(objects.size).toBe(0);
  expect(db.prepare("SELECT count(*) n FROM jobs").get()?.n).toBe(0);
  expect(db.prepare("SELECT story FROM parties").get()?.story).toBe(null);
  expect(db.prepare("SELECT names FROM parties").get()?.names).toBe("[]");
});
it("la simulation est refusée sur un hôte distant", async () => {
  env.APP_MODE = "local";
  const r = await worker.fetch(
    new Request("https://pixel.example/api/local/login", {
      method: "POST",
      body: "{}",
    }) as any,
    env,
    {} as any,
  );
  expect(r.status).toBe(503);
});

it("un remboursement arrivé avant le paiement empêche une activation tardive", async () => {
  await webhook(
    "refund_first",
    { payment_intent: "pi_one", refunded: true },
    "charge.refunded",
  );
  await webhook("paid_late", paid);
  expect(db.prepare("SELECT count(*) n FROM parties").get()?.n).toBe(0);
});
