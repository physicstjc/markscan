import { neon } from "@neondatabase/serverless";

let sqlClient;
let schemaPromise;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function ensureAnalyticsSchema() {
  if (!schemaPromise) {
    const sql = getSql();
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS analytics_events (
          event_id uuid PRIMARY KEY,
          event_name text NOT NULL,
          client_session_id uuid NOT NULL,
          page_path text NOT NULL,
          properties jsonb NOT NULL DEFAULT '{}'::jsonb,
          occurred_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx ON analytics_events (event_name, occurred_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS analytics_events_time_idx ON analytics_events (occurred_at DESC)`;
    })().catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}
