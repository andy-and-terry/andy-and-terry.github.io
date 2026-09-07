/*
 * Registry of bulk-friendly operations from the Video Toolkit (tools/video/).
 * Each entry points at the *actual* tool page — video-bulk.js loads it into a
 * hidden iframe per file and drives its real UI (set the file, set a few
 * option fields, click "process", read the result) rather than reimplementing
 * any ffmpeg logic here. Field ids below match the target page's own element
 * ids exactly (and the bulk settings panel in video-bulk.html reuses the same
 * ids), so applying options is just a generic id-to-id copy.
 */
var VIDEO_OPS = {
  compress: {
    label: "Compress",
    page: "../video/compress.html",
    fields: ["crf-range", "resolution-select", "audio-select", "speed-select"],
  },
  trim: {
    label: "Trim (keep first N seconds)",
    page: "../video/trim.html",
    special: "trim",
    fields: ["fast-mode"],
  },
  speed: {
    label: "Speed",
    page: "../video/speed.html",
    fields: ["speed-range", "mute-audio"],
  },
  "rotate-flip": {
    label: "Rotate / Flip",
    page: "../video/rotate-flip.html",
    fields: ["rotate-select", "flip-h", "flip-v"],
  },
  denoise: {
    label: "Denoise",
    page: "../video/denoise.html",
    fields: ["strength-select", "hq-mode"],
  },
  "color-adjust": {
    label: "Color Adjust",
    page: "../video/color-adjust.html",
    fields: ["brightness-range", "contrast-range", "saturation-range", "gamma-range"],
  },
  reverse: {
    label: "Reverse",
    page: "../video/reverse.html",
    fields: ["reverse-audio"],
  },
  "extract-audio": {
    label: "Extract Audio",
    page: "../video/audio.html",
    fields: ["format-select", "bitrate-select"],
  },
};

var VideoOpsRunner = (function () {
  var waitFor = BulkCommon.waitFor;
  var waitForLoad = BulkCommon.waitForLoad;

  /**
   * Injects `file` into the iframe's #file-input as if the user had chosen it.
   * A File constructed in the parent realm fails DataTransferItemList's type-brand
   * check inside the iframe's realm, so the bytes are rebuilt into a File made with
   * the iframe's own File constructor first.
   */
  function setFile(iframeWin, iframeDoc, file) {
    return file.arrayBuffer().then(function (buf) {
      var iframeFile = new iframeWin.File([buf], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      var input = iframeDoc.getElementById("file-input");
      var dt = new iframeWin.DataTransfer();
      dt.items.add(iframeFile);
      input.files = dt.files;
      input.dispatchEvent(new iframeWin.Event("change", { bubbles: true }));
    });
  }

  /** Copies each field's value/checked state from the bulk settings panel (same ids) into the iframe doc. */
  function applyOptions(iframeDoc, fieldIds) {
    fieldIds.forEach(function (id) {
      var src = document.getElementById(id);
      var dst = iframeDoc.getElementById(id);
      if (!src || !dst) return;
      if (dst.type === "checkbox") dst.checked = src.checked;
      else dst.value = src.value;
    });
  }

  /** Trim needs the source video's duration (loaded async) before its start/end range sliders can be set. */
  function applyTrim(iframeDoc, startSec, durationSec) {
    return waitFor(
      function () {
        var startRange = iframeDoc.getElementById("start-range");
        return parseFloat(startRange.max) > 0 ? startRange : null;
      },
      20000,
      100
    ).then(function (startRange) {
      var endRange = iframeDoc.getElementById("end-range");
      var clipDuration = parseFloat(startRange.max);
      var start = Math.max(0, Math.min(startSec, clipDuration));
      var end = Math.max(start, Math.min(start + durationSec, clipDuration));
      startRange.value = start;
      endRange.value = end;
    });
  }

  function waitForResult(iframeDoc, timeoutMs, onProgress) {
    var outputCard = iframeDoc.getElementById("output-card");
    var errorBanner = iframeDoc.getElementById("error-banner");
    var progressFill = iframeDoc.getElementById("progress-fill");
    var statusLine = iframeDoc.getElementById("status-line");
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      var timer = setInterval(function () {
        if (onProgress) {
          var w = progressFill && progressFill.style.width;
          var frac = w ? parseFloat(w) / 100 : null;
          onProgress(frac, statusLine ? statusLine.textContent : "");
        }
        if (outputCard.classList.contains("visible")) {
          clearInterval(timer);
          resolve();
        } else if (errorBanner && errorBanner.textContent.trim()) {
          clearInterval(timer);
          var logOutput = iframeDoc.getElementById("log-output");
          var logTail = logOutput ? logOutput.textContent.trim().split("\n").slice(-6).join(" | ") : "";
          reject(new Error(errorBanner.textContent.trim() + (logTail ? " (" + logTail + ")" : "")));
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error("Timed out waiting for processing to finish."));
        }
      }, 200);
    });
  }

  /**
   * Runs one file through one operation's real tool page inside a hidden iframe.
   * Resolves with { blob, filename }. The iframe (and its ffmpeg.wasm instance)
   * is torn down before resolving/rejecting so memory doesn't accumulate across files.
   */
  function run(op, file, opts, onProgress) {
    var iframe = BulkCommon.createHiddenIframe(op.page);

    function cleanup() {
      iframe.remove();
    }

    return waitForLoad(iframe, 20000)
      .then(function () {
        var iframeWin = iframe.contentWindow;
        var iframeDoc = iframe.contentDocument;
        return setFile(iframeWin, iframeDoc, file).then(function () {
          return op.special === "trim"
            ? applyTrim(iframeDoc, opts.trimStart, opts.trimDuration)
            : Promise.resolve();
        }).then(function () {
          applyOptions(iframeDoc, op.fields);
          iframeDoc.getElementById("process-btn").click();
          return waitForResult(iframeDoc, 10 * 60 * 1000, onProgress).then(function () {
            var downloadLink = iframeDoc.getElementById("download-link");
            var href = downloadLink.href;
            var filename = downloadLink.download || "output";
            return iframeWin.fetch(href).then(function (r) {
              return r.blob();
            }).then(function (blob) {
              return { blob: blob, filename: filename };
            });
          });
        });
      })
      .then(
        function (result) {
          cleanup();
          return result;
        },
        function (err) {
          cleanup();
          throw err;
        }
      );
  }

  return { run: run };
})();
