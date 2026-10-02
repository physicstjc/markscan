import { ensureAnalyticsSchema, getSql, isDatabaseConfigured } from "./_db.js";
import { sanitizeEvent } from "./_analytics.js";

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  if (process.env.ANALYTICS_ENABLED === "false") return response.status(404).json({ error: "not_found" });
  if (!isSameOrigin(request)) return response.status(403).json({ error: "origin_not_allowed" });
  if (Number(request.headers["content-length"] || 0) > 4096) return response.status(413).json({ error: "payload_too_large" });
  const event = sanitizeEvent(request.body);
  if (!event) return response.status(400).json({ error: "invalid_event" });
  if (!isDatabaseConfigured()) return response.status(503).json({ error: "database_not_configured" });

  try {
    await ensureAnalyticsSchema();
    const sql = getSql();
    await sql`
      INSERT INTO analytics_events (event_id, event_name, client_session_id, page_path, properties)
      VALUES (${event.eventId}, ${event.eventName}, ${event.sessionId}, ${event.pagePath}, ${JSON.stringify(event.properties)}::jsonb)
      ON CONFLICT (event_id) DO NOTHING
    `;
    return response.status(202).json({ accepted: true });
  } catch (error) {
    console.error("Analytics event insert failed", error);
    return response.status(500).json({ error: "event_insert_failed" });
  }
}
