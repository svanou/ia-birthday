import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { Env } from "./types";
import { allowed } from "./domain";
export function auth(e: Env) {
  if (!e.BETTER_AUTH_SECRET || !e.RESEND_API_KEY)
    throw new Error("AUTH_UNCONFIGURED");
  return betterAuth({
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(e.DB, { schema }), {
      provider: "sqlite",
      schema,
    }),
    trustedOrigins: [e.APP_URL],
    rateLimit: { enabled: true, storage: "database", window: 60, max: 10 },
    session: { expiresIn: 7 * 86400 },
    plugins: [
      magicLink({
        expiresIn: 600,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => {
          if (
            e.APP_MODE !== "live" &&
            !allowed(email, e.PILOT_EMAILS) &&
            !allowed(email, e.ADMIN_EMAILS)
          )
            return;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${e.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: e.EMAIL_FROM,
              to: email,
              subject: "Votre accès à Pixel",
              text: `Votre lien de connexion Pixel (valable 10 minutes) :\n${url}\n\nSi vous n’avez pas demandé cet accès, ignorez cet e-mail.`,
            }),
          });
          if (!r.ok) throw new Error("EMAIL_UNAVAILABLE");
        },
      }),
    ],
  });
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function token() {
  return crypto.randomUUID() + crypto.randomUUID();
}
