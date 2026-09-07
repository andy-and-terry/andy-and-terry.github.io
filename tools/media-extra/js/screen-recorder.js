(function () {
  "use strict";

  const unsupportedCard = document.getElementById("unsupported-card");
  const setupCard = document.getElementById("setup-card");
  const formatSelect = document.getElementById("format-select");
  const audioCheck = document.getElementById("audio-check");
  const mp4Hint = document.getElementById("mp4-hint");
  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const statusLine = document.getElementById("status-line");
  const errorBanner = document.getElementById("error-banner");
  const liveCard = document.getElementById("live-card");
  const livePreview = document.getElementById("live-preview");
  const timerEl = document.getElementById("timer");
  const outputCard = document.getElementById("output-card");
  const outputVideo = document.getElementById("output-video");
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  const supported =
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    typeof window.MediaRecorder === "function";

  if (!supported) {
    unsupportedCard.style.display = "block";
    setupCard.style.display = "none";
    return;
  }

  let stream = null;
  let recorder = null;
  let chunks = [];
  let outputURL = null;
  let timerHandle = null;
  let startTime = 0;
  let recordedMime = "video/webm";

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }
  function setStatus(text, spinning) {
    statusLine.innerHTML = "";
    if (spinning) {
      const s = document.createElement("div");
      s.className = "spinner";
      statusLine.appendChild(s);
    }
    const t = document.createElement("span");
    t.textContent = text || "";
    statusLine.appendChild(t);
  }
  function showError(msg) {
    errorBanner.innerHTML = '<div class="banner banner-error">' + msg + "</div>";
  }
  function clearError() {
    errorBanner.innerHTML = "";
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  formatSelect.addEventListener("change", function () {
    mp4Hint.style.display = formatSelect.value === "mp4" ? "block" : "none";
  });

  function pickMimeType() {
    const wantMp4 = formatSelect.value === "mp4";
    const candidates = wantMp4
      ? ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    for (const c of candidates) {
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(c)) {
        return c;
      }
    }
    return "";
  }

  function stopTimer() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
  }

  function cleanupStream() {
    if (stream) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      stream = null;
    }
    livePreview.srcObject = null;
    liveCard.style.display = "none";
  }

  startBtn.addEventListener("click", async function () {
    clearError();
    resetOutput();
    chunks = [];
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: audioCheck.checked,
      });
    } catch (err) {
      if (err && err.name === "NotAllowedError") {
        showError("Screen recording permission was denied. Click \"Start recording\" and allow sharing your screen or tab to continue.");
      } else if (err && err.name === "NotFoundError") {
        showError("No screen, window, or tab is available to share on this device.");
      } else {
        showError("Could not start screen capture. (" + ((err && err.message) || err) + ")");
      }
      return;
    }

    const mimeType = pickMimeType();
    if (!mimeType) {
      showError("No supported recording format was found in this browser.");
      cleanupStream();
      return;
    }
    recordedMime = mimeType.split(";")[0];

    try {
      recorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch (err) {
      showError("Could not create a recorder for this format. (" + ((err && err.message) || err) + ")");
      cleanupStream();
      return;
    }

    recorder.addEventListener("dataavailable", function (e) {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    });

    recorder.addEventListener("stop", function () {
      stopTimer();
      cleanupStream();
      startBtn.disabled = false;
      stopBtn.disabled = true;
      setStatus("");

      if (chunks.length === 0) {
        showError("No video data was captured.");
        return;
      }
      const blob = new Blob(chunks, { type: recordedMime });
      outputURL = URL.createObjectURL(blob);
      outputVideo.src = outputURL;
      outputSize.textContent = fmtBytes(blob.size);
      const ext = recordedMime.indexOf("mp4") >= 0 ? "mp4" : "webm";
      downloadLink.href = outputURL;
      downloadLink.download = "screen-recording." + ext;
      outputCard.classList.add("visible");
    });

    // If the user stops sharing from the browser's own "Stop sharing" UI.
    stream.getVideoTracks()[0].addEventListener("ended", function () {
      if (recorder && recorder.state === "recording") recorder.stop();
    });

    livePreview.srcObject = stream;
    liveCard.style.display = "block";
    startTime = Date.now();
    timerEl.textContent = "0:00";
    timerHandle = setInterval(function () {
      timerEl.textContent = fmtTime((Date.now() - startTime) / 1000);
    }, 500);

    recorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus("Recording…", true);
  });

  stopBtn.addEventListener("click", function () {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  });

  window.addEventListener("beforeunload", function () {
    if (recorder && recorder.state === "recording") recorder.stop();
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  });
})();
