const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const eventSchemas = {
  answer_key_saved: { question_count: [1, 45] },
  student_directory_configured: { student_count: [1, 10000] },
  pdf_selected: { pdf_count: [1, 100], sheet_count: [1, 10000] },
  processing_started: { pdf_count: [1, 100], sheet_count: [1, 10000] },
  processing_completed: {
    sheet_count: [0, 10000],
    successful_sheet_count: [0, 10000],
    failed_sheet_count: [0, 10000],
    duration_ms: [0, 86400000]
  },
  processing_failed: { sheet_count: [0, 10000], duration_ms: [0, 86400000] },
  results_edited: { item_count: [1, 10000] },
  report_generated: {
    report_scope: ["current", "all", "marked_current", "marked_all"],
    item_count: [1, 10000]
  },
  export_generated: {
    export_type: ["raw_csv", "student_entries_csv", "student_directory_template", "answer_sheet_template"],
    item_count: [0, 10000]
  },
  guided_setup_completed: {}
};

function sanitizeNumber(value, [minimum, maximum]) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(maximum, Math.max(minimum, value)));
}

function sanitizeProperties(eventName, input) {
  const schema = eventSchemas[eventName];
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const clean = {};
  for (const [key, rule] of Object.entries(schema)) {
    const value = source[key];
    if (typeof rule[0] === "number") {
      const sanitized = sanitizeNumber(value, rule);
      if (sanitized !== undefined) clean[key] = sanitized;
    } else if (typeof value === "string" && rule.includes(value)) {
      clean[key] = value;
    }
  }
  return clean;
}

export function sanitizeEvent(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (!UUID_PATTERN.test(input.event_id) || !UUID_PATTERN.test(input.session_id)) return null;
  if (!Object.hasOwn(eventSchemas, input.event_name)) return null;
  const pagePath = typeof input.page_path === "string" ? input.page_path.trim() : "";
  if (!pagePath.startsWith("/") || pagePath.length > 160 || /[?#]/.test(pagePath)) return null;
  return {
    eventId: input.event_id,
    eventName: input.event_name,
    sessionId: input.session_id,
    pagePath,
    properties: sanitizeProperties(input.event_name, input.properties)
  };
}

export const allowedEventNames = Object.freeze(Object.keys(eventSchemas));
