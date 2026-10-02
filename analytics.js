(function () {
  "use strict";

  const measurementId = "G-7VK5RL8WPN";
  const consentKey = "markscan.analytics-consent";
  const sessionKey = "markscan.analytics-session";
  const isLocal = location.protocol === "file:" || ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  let consent = readStorage(localStorage, consentKey);
  let googleAnalyticsReady = false;

  function readStorage(storage, key) {
    try { return storage.getItem(key); } catch { return null; }
  }

  function writeStorage(storage, key, value) {
    try { storage.setItem(key, value); } catch {}
  }

  function createId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
      const value = Math.random() * 16 | 0;
      return (character === "x" ? value : (value & 3 | 8)).toString(16);
    });
  }

  function getSessionId() {
    let id = readStorage(sessionStorage, sessionKey);
    if (!id) {
      id = createId();
      writeStorage(sessionStorage, sessionKey, id);
    }
    return id;
  }

  function initializeGoogleAnalytics() {
    if (googleAnalyticsReady || isLocal || consent !== "granted") return;
    googleAnalyticsReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500
    });
    window.gtag("js", new Date());
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("config", measurementId, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  function sanitizeClientProperties(properties) {
    const clean = {};
    for (const [key, value] of Object.entries(properties || {})) {
      if (typeof value === "number" && Number.isFinite(value)) clean[key] = Math.round(value);
      if (typeof value === "string" && value.length <= 40) clean[key] = value;
    }
    return clean;
  }

  function track(eventName, properties) {
    if (isLocal || consent !== "granted") return;
    initializeGoogleAnalytics();
    const cleanProperties = sanitizeClientProperties(properties);
    window.gtag?.("event", eventName, cleanProperties);
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: createId(),
        event_name: eventName,
        session_id: getSessionId(),
        page_path: location.pathname,
        properties: cleanProperties
      }),
      keepalive: true,
      credentials: "same-origin"
    }).catch(() => {});
  }

  function setConsent(nextConsent) {
    consent = nextConsent;
    writeStorage(localStorage, consentKey, nextConsent);
    document.getElementById("analytics-consent")?.remove();
    if (nextConsent === "granted") initializeGoogleAnalytics();
    else if (googleAnalyticsReady) window.gtag?.("consent", "update", { analytics_storage: "denied" });
  }

  function addConsentStyles() {
    if (document.getElementById("analytics-consent-styles")) return;
    const style = document.createElement("style");
    style.id = "analytics-consent-styles";
    style.textContent = `
      .analytics-consent{position:fixed;z-index:2000;left:18px;right:18px;bottom:18px;max-width:720px;margin:auto;padding:16px 18px;border:1px solid #3f5367;border-radius:8px;background:#101c26;color:#f7fafc;box-shadow:0 18px 50px #0008;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
      .analytics-consent strong{display:block;margin-bottom:4px}.analytics-consent p{margin:0;color:#c3ced8}
      .analytics-consent-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
      .analytics-consent button,.analytics-privacy-button{border:1px solid #53697c;border-radius:7px;padding:8px 12px;background:#172a38;color:#f7fafc;font:600 13px system-ui;cursor:pointer}
      .analytics-consent button[data-consent=granted]{border-color:#2dd4bf;background:#2dd4bf;color:#062a25}
      .analytics-consent button:focus-visible,.analytics-privacy-button:focus-visible{outline:3px solid #5eead466;outline-offset:2px}
      .analytics-privacy-button{position:fixed;z-index:900;left:12px;bottom:12px;padding:6px 9px;background:#101c26cc;color:#cbd5df;font-size:11px}
      @media print{.analytics-consent,.analytics-privacy-button{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function showConsentDialog() {
    if (isLocal) return;
    addConsentStyles();
    document.getElementById("analytics-consent")?.remove();
    const dialog = document.createElement("section");
    dialog.id = "analytics-consent";
    dialog.className = "analytics-consent";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-labelledby", "analytics-consent-title");
    dialog.innerHTML = `
      <strong id="analytics-consent-title">Help improve MarkScan</strong>
      <p>With your permission, MarkScan records anonymous visits and aggregate usage counts. Student data, answers, scores, exam titles and files are never sent.</p>
      <div class="analytics-consent-actions">
        <button type="button" data-consent="denied">Decline</button>
        <button type="button" data-consent="granted">Allow analytics</button>
      </div>`;
    dialog.addEventListener("click", function (event) {
      const choice = event.target.closest("[data-consent]")?.dataset.consent;
      if (choice) setConsent(choice);
    });
    document.body.appendChild(dialog);
    dialog.querySelector(`[data-consent="${consent === "granted" ? "denied" : "granted"}"]`)?.focus();
  }

  function initializeConsentUi() {
    if (isLocal) return;
    addConsentStyles();
    const privacyButton = document.createElement("button");
    privacyButton.type = "button";
    privacyButton.className = "analytics-privacy-button";
    privacyButton.textContent = "Privacy choices";
    privacyButton.addEventListener("click", showConsentDialog);
    document.body.appendChild(privacyButton);
    if (consent === "granted") initializeGoogleAnalytics();
    else if (consent !== "denied") showConsentDialog();
  }

  window.markscanAnalytics = {
    track,
    openPreferences: showConsentDialog,
    hasConsent: function () { return consent === "granted"; }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializeConsentUi);
  else initializeConsentUi();
})();
