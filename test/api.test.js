import assert from "node:assert/strict";
import test from "node:test";
import eventHandler from "../api/events.js";
import metricsHandler from "../api/metrics.js";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

const validEvent = {
  event_id: "1f3577ac-1d52-4b70-a05c-bf6d9003390d",
  event_name: "pdf_selected",
  session_id: "92e3185e-62d7-4e78-83f5-420b58077691",
  page_path: "/index.html",
  properties: { pdf_count: 1, sheet_count: 12 }
};

test("event endpoint rejects invalid payloads before database access", async () => {
  const response = createResponse();
  await eventHandler({ method: "POST", headers: { host: "markscan.test" }, body: { event_name: "private_data" } }, response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, { error: "invalid_event" });
});

test("event endpoint reports missing database configuration", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const response = createResponse();
  await eventHandler({ method: "POST", headers: { host: "markscan.test" }, body: validEvent }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: "database_not_configured" });
  if (previous) process.env.DATABASE_URL = previous;
});

test("metrics endpoint can be protected by an access token", async () => {
  const previous = process.env.METRICS_ACCESS_TOKEN;
  process.env.METRICS_ACCESS_TOKEN = "test-secret";
  const response = createResponse();
  await metricsHandler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: "metrics_auth_required" });
  if (previous === undefined) delete process.env.METRICS_ACCESS_TOKEN;
  else process.env.METRICS_ACCESS_TOKEN = previous;
});

test("metrics endpoint reports missing database configuration", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousToken = process.env.METRICS_ACCESS_TOKEN;
  delete process.env.DATABASE_URL;
  delete process.env.METRICS_ACCESS_TOKEN;
  const response = createResponse();
  await metricsHandler({ method: "GET", headers: {} }, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { error: "database_not_configured" });
  if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
  if (previousToken) process.env.METRICS_ACCESS_TOKEN = previousToken;
});
