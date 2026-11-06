import { describe, it, expect } from "vitest";
import {
  provision,
  optionsFrom,
  mergeRules,
  originalRule,
  client,
} from "../../scripts/production/provision.mjs";
const env = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "test-token",
  PIXEL_EMAIL_FROM: "Pixel <contact@pixel.test>",
  PIXEL_ADMIN_EMAILS: "owner@example.test",
};
function fake({ publicBucket = false, missingSubdomain = false } = {}) {
  const s = {
    db: null,
    bucket: false,
    queue: false,
    rules: [
      {
        id: "existing-other-rule",
        enabled: true,
        conditions: { prefix: "other/" },
      },
    ],
    writes: [],
  };
  const api = async (path, method = "GET", body) => {
    if (method !== "GET") s.writes.push({ path, method, body });
    let result;
    if (path === "/workers/subdomain")
      result = missingSubdomain ? {} : { subdomain: "real-account" };
    else if (path.startsWith("/d1/database?"))
      return { result: s.db ? [s.db] : [], result_info: { total_pages: 1 } };
    else if (path === "/d1/database" && method === "POST") {
      s.db = { name: body.name, uuid: "db-created" };
      result = s.db;
    } else if (path === "/r2/buckets" && method === "POST") {
      s.bucket = true;
      result = { name: body.name };
    } else if (path.endsWith("/domains/managed"))
      result = { enabled: publicBucket };
    else if (path.endsWith("/domains/custom")) result = { domains: [] };
    else if (path.endsWith("/lifecycle")) {
      if (method === "PUT") s.rules = body.rules;
      result = { rules: s.rules };
    } else if (path.startsWith("/r2/buckets/")) {
      if (!s.bucket) return null;
      result = { name: path.split("/").at(-1) };
    } else if (path.startsWith("/queues?"))
      result = s.queue
        ? [{ queue_name: "pixel-birthday-pilot-generations" }]
        : [];
    else if (path === "/queues" && method === "POST") {
      s.queue = true;
      result = { queue_id: "queue-created" };
    } else throw Error("Unexpected request " + method + " " + path);
    return { success: true, result };
  };
  return { s, api };
}
describe("production resource provisioning", () => {
  it("requires an explicit account and sender before any service creation", () => {
    expect(() => optionsFrom({}, "pilot")).toThrow("CLOUDFLARE_ACCOUNT_ID");
    expect(() => optionsFrom({ ...env, PIXEL_EMAIL_FROM: "" })).toThrow(
      "PIXEL_EMAIL_FROM",
    );
    expect(() => optionsFrom(env, "other")).toThrow("Stage");
  });
  it("creates resources once, preserves unrelated rules, never opens sales", async () => {
    const f = fake(),
      o = optionsFrom(env);
    const config = await provision(o, f.api);
    expect(config.name).toBe("pixel-birthday-pilot");
    expect(config.vars.APP_URL).toBe(
      "https://pixel-birthday-pilot.real-account.workers.dev",
    );
    expect(config.vars.SALES_ENABLED).toBe("false");
    expect(config.vars.LEGAL_READY).toBe("false");
    expect(config.triggers.crons).toEqual(["0 * * * *"]);
    expect(f.s.rules).toHaveLength(2);
    const writes = f.s.writes.length;
    await provision(o, f.api);
    expect(f.s.writes).toHaveLength(writes);
    expect(JSON.stringify(config)).not.toContain(env.CLOUDFLARE_API_TOKEN);
  });
  it("refuses to bind a public bucket rather than exposing drawings", async () => {
    const f = fake({ publicBucket: true });
    await expect(provision(optionsFrom(env), f.api)).rejects.toThrow("privacy");
    expect(f.s.queue).toBe(false);
  });
  it("does not invent an address or create paid resources without an account namespace", async () => {
    const f = fake({ missingSubdomain: true });
    await expect(provision(optionsFrom(env), f.api)).rejects.toThrow(
      "subdomain",
    );
    expect(f.s.writes).toHaveLength(0);
  });
  it("retains lifecycle rules and cannot replace an unreadable configuration", () => {
    expect(() => mergeRules(null)).toThrow();
    expect(mergeRules([originalRule])).toEqual([originalRule]);
    expect(originalRule.conditions.prefix).toBe("originals/");
    expect(originalRule.deleteObjectsTransition.condition.maxAge).toBe(86400);
  });
  it("fails on a provider denial without printing the token or response body", async () => {
    const api = client(
      "account",
      "test-secret",
      async () =>
        new Response("echoed credential should never appear", { status: 403 }),
    );
    await expect(api("/d1/database")).rejects.toThrow("HTTP 403");
    try {
      await api("/d1/database");
    } catch (e) {
      expect(e.message).not.toContain("test-secret");
      expect(e.message).not.toContain("echoed");
    }
  });
  it("keeps pilot and live resource names distinct", () => {
    expect(optionsFrom(env, "live").name).not.toBe(
      optionsFrom(env, "pilot").name,
    );
  });
});
