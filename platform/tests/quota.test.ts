import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, it, expect } from "vitest";
import { reservationSQL } from "../worker/quota";
let db: DatabaseSync;
let now = 10000000;
beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec(readFileSync("platform/migrations/0001.sql", "utf8"));
  db.prepare(
    "INSERT INTO parties(id,owner,purchased_at,activate_by,activated_at,ends_at,retain_until) VALUES('p','parent',?, ?, ?, ?, ?)",
  ).run(now, now + 10000, now, now + 10000, now + 100000);
});
afterEach(() => db.close());
function reserve(id: string, kind = "image", upload = id) {
  return db
    .prepare(reservationSQL(kind))
    .run(
      id,
      "p",
      kind,
      "Luna",
      upload,
      now,
      "p",
      kind,
      kind === "trial" ? 1 : 20,
      "p",
      "p",
      now - 3600000,
      "p",
      now,
    ).changes;
}
it("20 créations maximum même si les appels se succèdent après libération de la file", () => {
  for (let i = 0; i < 20; i++) {
    expect(reserve(String(i))).toBe(1);
    db.prepare("UPDATE jobs SET status='done' WHERE id=?").run(String(i));
  }
  expect(reserve("21")).toBe(0);
});
it("deux créations au maximum simultanément ; idempotence et dessin à usage unique", () => {
  expect(reserve("a")).toBe(1);
  expect(reserve("a")).toBe(0);
  expect(reserve("b", "image", "a")).toBe(0);
  expect(reserve("b")).toBe(1);
  expect(reserve("c")).toBe(0);
});
it("un échec libère la réservation sans crédit gratuit supplémentaire après un succès", () => {
  reserve("a");
  db.exec("UPDATE jobs SET status='failed' WHERE id='a'");
  expect(reserve("b")).toBe(1);
  const count = db
    .prepare("SELECT count(*) n FROM jobs WHERE status!='failed'")
    .get();
  expect(count?.n).toBe(1);
});
it("un seul essai avant activation et aucun après", () => {
  expect(reserve("trial", "trial")).toBe(0);
  db.exec("UPDATE parties SET activated_at=NULL,ends_at=NULL");
  expect(reserve("trial", "trial")).toBe(1);
  db.exec("UPDATE jobs SET status='done'");
  expect(reserve("second", "trial")).toBe(0);
});
it("expiration ou révocation entre lecture de session et réservation refuse la création", () => {
  db.prepare("UPDATE parties SET ends_at=?").run(now);
  expect(reserve("a")).toBe(0);
  db.prepare("UPDATE parties SET ends_at=?,status='revoked'").run(now + 1000);
  expect(reserve("b")).toBe(0);
});
