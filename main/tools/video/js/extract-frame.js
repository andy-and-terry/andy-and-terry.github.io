(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const BASE_URL = "lib";

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileInfo = document.getElementById("file-info");
  const fileNameEl = document.getElementById("file-name");
  const fileSizeEl = document.getElementById("file-size");
  const preview = document.getElementById("preview");
  const controlsCard = document.getElementById("controls-card");
  const timeRange = document.getElementById("time-range");
  const timePill = document.getElementById("time-pill");
  const useCurrentBtn = document.getElementById("use-current-btn");
  const formatSelect = document.getElementById("format-select");
  const qualityField = document.getElementById("jpg-quality-field");
  const qualityRange = document.getElementById("quality-range");
  const qualityPill = document.getElementById("quality-pill");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const outputImage = document.getElementById("output-image");
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  let ffmpeg = null;
  let coreLoaded = false;
  let currentFile = null;
  let previewURL = null;
  let outputURL = null;
  let duration = 0;
  let busy = false;

  function fmtTime(s) {
    if (!isFinite(s)) return "0:00.0";
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(1);
    return m + ":" + (sec.length < 4 ? "0" + sec : sec);
  }
  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
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
  function appendLog(msg) {
    logOutput.textContent += msg + "\n";
    logOutput.parentElement.scrollTop = logOutput.parentElement.scrollHeight;
  }
  function setProgress(fraction) {
    if (fraction == null || !isFinite(fraction)) return;
    const pct = Math.max(0, Math.min(100, fraction * 100));
    progressTrack.style.display = "block";
    progressFill.style.width = pct + "%";
  }
  function baseName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  }
  function extName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1) : "mp4";
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|avi|m4v|flv|wmv)$/i.test(file.name)) {
      showError("That doesn't look like a video file.");
      return;
    }
    clearError();
    resetOutput();
    currentFile = file;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    preview.src = previewURL;
    preview.style.display = "block";
    fileInfo.style.display = "flex";
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = fmtBytes(file.size);
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";

    preview.onloadedmetadata = function () {
      duration = preview.duration || 0;
      timeRange.max = duration;
      timeRange.value = 0;
      updateTimePill();
    };
  }

  function updateTimePill() {
    timePill.textContent = fmtTime(parseFloat(timeRange.value));
  }
  timeRange.addEventListener("input", updateTimePill);

  useCurrentBtn.addEventListener("click", function () {
    timeRange.value = preview.currentTime;
    updateTimePill();
  });

  function updateQualityPill() {
    const v = parseInt(qualityRange.value, 10);
    qualityPill.textContent = v <= 4 ? "high" : v <= 9 ? "medium" : "low";
  }
  qualityRange.addEventListener("input", updateQualityPill);
  updateQualityPill();

  function syncFormatUI() {
    qualityField.style.display = formatSelect.value === "jpg" ? "block" : "none";
  }
  formatSelect.addEventListener("change", syncFormatUI);
  syncFormatUI();

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    handleFile(fileInput.files[0]);
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    handleFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  async function ensureFFmpeg() {
    if (coreLoaded) return;
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
      ffmpeg.on("log", function (e) {
        appendLog(e.message);
      });
      ffmpeg.on("progress", function (e) {
        setProgress(e.progress);
      });
    }
    setStatus("Downloading ffmpeg engine (~30 MB, first run only)…", true);
    try {
      const coreURL = await toBlobURL(BASE_URL + "/ffmpeg-core.js", "text/javascript");
      const wasmURL = await toBlobURL(BASE_URL + "/ffmpeg-core.wasm", "application/wasm", true, function (p) {
        if (p.total > 0) setProgress(p.received / p.total);
        setStatus("Downloading ffmpeg engine… " + fmtBytes(p.received) + (p.total > 0 ? " / " + fmtBytes(p.total) : ""), true);
      });
      await ffmpeg.load({ coreURL: coreURL, wasmURL: wasmURL });
      coreLoaded = true;
      progressTrack.style.display = "none";
      progressFill.style.width = "0%";
    } catch (err) {
      throw new Error(
        "Could not load the ffmpeg engine. Make sure the files in lib/ are present and you're serving this page over http(s), not file://. (" +
          (err && err.message ? err.message : err) +
          ")"
      );
    }
  }

  processBtn.addEventListener("click", async function () {
    if (busy || !currentFile) return;
    clearError();
    resetOutput();
    busy = true;
    processBtn.disabled = true;
    logOutput.textContent = "";
    setProgress(0);

    const inExt = extName(currentFile.name);
    const inName = "input." + inExt;
    const format = formatSelect.value;
    const outName = "output." + format;
    const time = parseFloat(timeRange.value).toFixed(3);

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      const args = ["-i", inName, "-ss", time, "-frames:v", "1"];
      if (format === "jpg") args.push("-q:v", qualityRange.value);
      args.push(outName);

      setStatus("Extracting frame…", true);
      const ret = await ffmpeg.exec(args);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
      }

      const data = await ffmpeg.readFile(outName);
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const blob = new Blob([data.buffer], { type: mime });
      outputURL = URL.createObjectURL(blob);
      outputImage.src = outputURL;
      outputSize.textContent = fmtBytes(blob.size);
      downloadLink.href = outputURL;
      downloadLink.download = baseName(currentFile.name) + "-frame." + format;
      outputCard.classList.add("visible");
      setStatus("Done.", false);
      setProgress(1);

      try {
        await ffmpeg.deleteFile(inName);
        await ffmpeg.deleteFile(outName);
      } catch (_) {}
    } catch (err) {
      showError((err && err.message) || String(err));
      setStatus("Failed.", false);
    } finally {
      busy = false;
      processBtn.disabled = false;
    }
  });
})();
