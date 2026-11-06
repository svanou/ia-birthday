export function reservationSQL(kind: string) {
  return `INSERT OR IGNORE INTO jobs(id,party,kind,alias,upload,status,created_at) SELECT ?,?,?,?,?,'queued',? WHERE (SELECT COUNT(*) FROM jobs WHERE party=? AND kind=? AND status!='failed')<? AND (SELECT COUNT(*) FROM jobs WHERE party=? AND status IN ('queued','running'))<2 AND (SELECT COUNT(*) FROM jobs WHERE party=? AND created_at>?)<40 AND EXISTS(SELECT 1 FROM parties WHERE id=? AND status='paid' AND ${kind === "trial" ? "activated_at IS NULL AND activate_by>?" : "ends_at>?"})`;
}
