/* ── MAL Enhancer – Background Service Worker ─────────────────────
   Provides un-throttled timer ticks to the content script via
   a persistent port connection.  Background service workers are
   NOT subject to tab-level timer throttling, so this keeps the
   rewatch-data loading process running at full speed even when
   the user switches to a different tab.
──────────────────────────────────────────────────────────────── */

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "rewatch-timer") return;

  let intervalId = null;

  port.onMessage.addListener((msg) => {
    if (msg.action === "start") {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        try {
          port.postMessage({ action: "tick" });
        } catch {
          // Port closed — clean up
          clearInterval(intervalId);
          intervalId = null;
        }
      }, msg.intervalMs || 1000);
    }

    if (msg.action === "stop") {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }
  });

  port.onDisconnect.addListener(() => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  });
});
