export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  GENERATIONS: Queue<{ id: string }>;
  ASSETS: Fetcher;
  APP_MODE: string;
  APP_URL: string;
  PILOT_EMAILS: string;
  ADMIN_EMAILS: string;
  SALES_ENABLED: string;
  LEGAL_READY: string;
  EMAIL_FROM: string;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_KEY: string;
}
