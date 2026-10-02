import { timingSafeEqual } from "node:crypto";
import { ensureAnalyticsSchema, getSql, isDatabaseConfigured } from "./_db.js";

function hasMetricsAccess(request) {
  const expected = process.env.METRICS_ACCESS_TOKEN;
  if (!expected) return true;
  const authorization = request.headers.authorization || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : request.headers["x-metrics-token"] || "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(String(provided));
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "method_not_allowed" });
  }
  if (process.env.METRICS_ENABLED === "false") return response.status(404).json({ error: "metrics_disabled" });
  if (!hasMetricsAccess(request)) return response.status(401).json({ error: "metrics_auth_required" });
  if (!isDatabaseConfigured()) return response.status(503).json({ error: "database_not_configured" });

  try {
    await ensureAnalyticsSchema();
    const sql = getSql();
    const [summaryRows, weeklyRows, outputRows] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_name = 'processing_completed') AS completed_runs,
          COUNT(*) FILTER (WHERE event_name = 'processing_failed') AS failed_runs,
          COALESCE(SUM((properties->>'sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed'), 0) AS total_sheets,
          COALESCE(SUM((properties->>'successful_sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed'), 0) AS successful_sheets,
          COALESCE(SUM((properties->>'failed_sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed'), 0) AS failed_sheets,
          COALESCE(AVG((properties->>'sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed'), 0) AS average_sheets_per_run,
          COALESCE(AVG((properties->>'duration_ms')::numeric) FILTER (WHERE event_name = 'processing_completed'), 0) AS average_duration_ms,
          COALESCE(SUM((properties->>'sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed' AND occurred_at >= now() - interval '7 days'), 0) AS sheets_7_days,
          COALESCE(SUM((properties->>'sheet_count')::numeric) FILTER (WHERE event_name = 'processing_completed' AND occurred_at >= now() - interval '30 days'), 0) AS sheets_30_days
        FROM analytics_events
      `,
      sql`
        WITH weeks AS (
          SELECT generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS week_start
        )
        SELECT to_char(weeks.week_start, 'YYYY-MM-DD') AS week,
          COALESCE(SUM((events.properties->>'sheet_count')::numeric), 0) AS sheets,
          COUNT(events.event_id) AS runs
        FROM weeks
        LEFT JOIN analytics_events events ON events.event_name = 'processing_completed'
          AND events.occurred_at >= weeks.week_start AND events.occurred_at < weeks.week_start + interval '1 week'
        GROUP BY weeks.week_start ORDER BY weeks.week_start
      `,
      sql`SELECT COUNT(*) FILTER (WHERE event_name = 'export_generated') AS exports,
        COUNT(*) FILTER (WHERE event_name = 'report_generated') AS reports FROM analytics_events`
    ]);
    const summary = summaryRows[0];
    const outputs = outputRows[0];
    const successfulSheets = number(summary.successful_sheets);
    const totalSheets = number(summary.total_sheets);
    return response.status(200).json({
      generated_at: new Date().toISOString(),
      summary: {
        total_sheets: totalSheets,
        completed_runs: number(summary.completed_runs),
        failed_runs: number(summary.failed_runs),
        successful_sheets: successfulSheets,
        failed_sheets: number(summary.failed_sheets),
        success_rate: totalSheets ? Math.round((successfulSheets / totalSheets) * 1000) / 10 : 0,
        sheets_7_days: number(summary.sheets_7_days),
        sheets_30_days: number(summary.sheets_30_days),
        average_sheets_per_run: Math.round(number(summary.average_sheets_per_run) * 10) / 10,
        average_duration_ms: Math.round(number(summary.average_duration_ms)),
        exports_generated: number(outputs.exports),
        reports_generated: number(outputs.reports)
      },
      weekly: weeklyRows.map((row) => ({ week: row.week, sheets: number(row.sheets), runs: number(row.runs) }))
    });
  } catch (error) {
    console.error("Metrics query failed", error);
    return response.status(500).json({ error: "metrics_query_failed" });
  }
}
