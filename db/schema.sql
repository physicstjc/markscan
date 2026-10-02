CREATE TABLE IF NOT EXISTS analytics_events (
  event_id uuid PRIMARY KEY,
  event_name text NOT NULL,
  client_session_id uuid NOT NULL,
  page_path text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx
  ON analytics_events (event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_time_idx
  ON analytics_events (occurred_at DESC);

COMMENT ON TABLE analytics_events IS
  'Privacy-safe MarkScan usage events. Never stores student, exam, answer, score, or file data.';
