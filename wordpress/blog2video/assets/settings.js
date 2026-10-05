window.Blog2VideoInitSettings = function () {
  "use strict";

  var status = document.getElementById("b2v-approval-status");
  if (!status || !window.Blog2VideoSettings) return;

  var stopped = false;
  var failures = 0;

  function setStatus(message, isError) {
    var copy = status.querySelector("span");
    if (copy) copy.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function poll() {
    if (stopped) return;
    var body = new URLSearchParams();
    body.set("action", "blog2video_connection_status");
    body.set("nonce", Blog2VideoSettings.nonce);

    fetch(Blog2VideoSettings.ajaxUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: body.toString()
    }).then(function (response) {
      return response.json();
    }).then(function (payload) {
      failures = 0;
      if (!payload.success) {
        throw new Error((payload.data && payload.data.message) || "Could not check approval.");
      }
      if (payload.data.status === "connected") {
        stopped = true;
        setStatus("Connected. Returning to settings…", false);
        window.location.replace(payload.data.redirect);
        return;
      }
      setStatus("Waiting for approval…", false);
      window.setTimeout(poll, 2000);
    }).catch(function (error) {
      failures += 1;
      if (failures < 3) {
        window.setTimeout(poll, 2500);
        return;
      }
      stopped = true;
      setStatus(error.message || "Could not complete the connection. Refresh and try again.", true);
    });
  }

  window.setTimeout(poll, 800);
};
