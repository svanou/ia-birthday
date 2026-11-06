import { describe, it, expect } from "vitest";
import {
  phase,
  canGenerate,
  sixMonths,
  HOURS,
  DAY,
  isLocal,
  allowed,
  type Party,
} from "../worker/domain";
const now = Date.UTC(2026, 0, 31, 12),
  base: Party = {
    id: "p",
    owner: "parent@example.com",
    theme: "forest",
    names: '["Luna"]',
    status: "paid",
    purchased_at: now,
    activate_by: sixMonths(now),
    activated_at: null,
    ends_at: null,
    retain_until: sixMonths(now) + 30 * DAY,
    step: 0,
    story: null,
    story_approved: 0,
    payment_id: null,
  };
describe("droits de session", () => {
  it("préparation : seul l’essai est autorisé", () => {
    expect(phase(base, now)).toBe("preparation");
    expect(canGenerate(base, "trial", now)).toBe(true);
    expect(canGenerate(base, "image", now)).toBe(false);
  });
  it("quatre heures fixes, expiration exacte et galerie séparée", () => {
    const p = {
      ...base,
      activated_at: now,
      ends_at: now + HOURS,
      retain_until: now + HOURS + 30 * DAY,
    };
    expect(canGenerate(p, "image", now + HOURS - 1)).toBe(true);
    expect(canGenerate(p, "trial", now)).toBe(false);
    expect(phase(p, now + HOURS)).toBe("gallery");
    expect(canGenerate(p, "image", now + HOURS)).toBe(false);
    expect(phase(p, p.retain_until)).toBe("deleted");
  });
  it("ne donne jamais accès à une session révoquée", () =>
    expect(canGenerate({ ...base, status: "revoked" }, "trial", now)).toBe(
      false,
    ));
  it("l’achat expire après six mois calendaires", () => {
    expect(new Date(sixMonths(Date.UTC(2026, 7, 31))).toISOString()).toBe(
      "2027-02-28T00:00:00.000Z",
    );
    expect(phase(base, base.activate_by)).toBe("expired");
  });
  it("le mode de simulation reste réservé à localhost", () => {
    expect(isLocal("local", "http://localhost:8787")).toBe(true);
    expect(isLocal("pilot", "http://localhost:8787")).toBe(false);
    expect(isLocal("local", "https://pixel.workers.dev")).toBe(false);
    expect(isLocal("local", "https://localhost.evil.test")).toBe(false);
  });
  it("les invitations et admins correspondent à une adresse entière", () => {
    expect(allowed("A@ex.fr", " a@ex.fr , b@ex.fr")).toBe(true);
    expect(allowed("bad-a@ex.fr", "a@ex.fr")).toBe(false);
    expect(allowed("", "")).toBe(false);
  });
});
