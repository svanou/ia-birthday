-- Stripe events may arrive out of order. A refund must also block a late grant.
CREATE TABLE refunded_payments(payment_id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
