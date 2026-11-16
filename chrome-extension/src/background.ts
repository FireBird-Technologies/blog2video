import { collectPendingConnection } from "./lib/connection";

const POLL_ALARM = "b2v-connection-poll";
const FAST_POLL_MS = 2000;
let fastPollTimer: ReturnType<typeof setTimeout> | null = null;

// chrome.alarms clamps repeating alarms to a 1-minute floor, which is too
// slow right after the user clicks "Approve" (they expect the popup to
// react within a couple of seconds). setTimeout gives a tight 2s cadence
// while the service worker is alive; the alarm below is the safety net once
// the worker is suspended mid-flow (the popup also collects the token itself
// whenever it is opened — see lib/connection.ts).
async function checkConnection(): Promise<boolean> {
  // Stop on anything but "still waiting"; transient network errors keep polling.
  return (await collectPendingConnection()) !== "pending";
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
    // 0.5 is the shortest period Chrome allows for alarms (Chrome 120+).
    chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
  }
  if (message?.type === "b2v-stop-polling") {
    stopPolling();
  }
});
