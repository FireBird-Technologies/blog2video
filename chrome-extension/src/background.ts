import { exchangeConnectionToken } from "./api/client";
import { clearPendingConnection, getPendingConnection, setAuth } from "./lib/storage";

const POLL_ALARM = "b2v-connection-poll";
const FAST_POLL_MS = 2000;
let fastPollTimer: ReturnType<typeof setTimeout> | null = null;

// chrome.alarms clamps repeating alarms to a 1-minute floor, which is too
// slow right after the user clicks "Approve" (they expect the popup to
// react within a couple of seconds). setTimeout gives a tight 2s cadence
// while the service worker is alive; the alarm below is only a once-a-minute
// safety net in case the worker gets suspended mid-flow.
async function checkConnection(): Promise<boolean> {
  const pending = await getPendingConnection();
  if (!pending) return true; // nothing to do — stop polling
  try {
    const result = await exchangeConnectionToken(pending.connectionId, pending.deviceCode);
    if (result.status === "connected") {
      await setAuth({ accessToken: result.access_token });
      await clearPendingConnection();
      return true;
    }
    return false;
  } catch {
    // Expired or invalid — stop polling, the popup will let the user restart.
    await clearPendingConnection();
    return true;
  }
}

function stopPolling() {
  if (fastPollTimer) {
    clearTimeout(fastPollTimer);
    fastPollTimer = null;
  }
  chrome.alarms.clear(POLL_ALARM);
}

function scheduleFastPoll() {
  if (fastPollTimer) clearTimeout(fastPollTimer);
  fastPollTimer = setTimeout(async () => {
    const done = await checkConnection();
    if (done) stopPolling();
    else scheduleFastPoll();
  }, FAST_POLL_MS);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== POLL_ALARM) return;
  const done = await checkConnection();
  if (done) stopPolling();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "b2v-start-polling") {
    scheduleFastPoll();
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 });
  }
  if (message?.type === "b2v-stop-polling") {
    stopPolling();
  }
});
