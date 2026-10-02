import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeEvent } from "../api/_analytics.js";

const baseEvent = {
  event_id: "1f3577ac-1d52-4b70-a05c-bf6d9003390d",
  session_id: "92e3185e-62d7-4e78-83f5-420b58077691",
  page_path: "/index.html"
};

test("accepts an allowed aggregate event", () => {
  const event = sanitizeEvent({
    ...baseEvent,
    event_name: "processing_completed",
    properties: { sheet_count: 12, successful_sheet_count: 11, failed_sheet_count: 1, duration_ms: 1234 }
  });
  assert.deepEqual(event.properties, { sheet_count: 12, successful_sheet_count: 11, failed_sheet_count: 1, duration_ms: 1234 });
});

test("drops unknown fields that could contain private data", () => {
  const event = sanitizeEvent({
    ...baseEvent,
    event_name: "student_directory_configured",
    properties: { student_count: 30, student_name: "Private name", filename: "class-list.csv" }
  });
  assert.deepEqual(event.properties, { student_count: 30 });
});

test("rejects unknown events and malformed identifiers", () => {
  assert.equal(sanitizeEvent({ ...baseEvent, event_name: "student_score_saved" }), null);
  assert.equal(sanitizeEvent({ ...baseEvent, event_id: "not-a-uuid", event_name: "pdf_selected" }), null);
});

test("rejects page paths containing query data", () => {
  assert.equal(sanitizeEvent({ ...baseEvent, page_path: "/?student=1234", event_name: "pdf_selected" }), null);
});
