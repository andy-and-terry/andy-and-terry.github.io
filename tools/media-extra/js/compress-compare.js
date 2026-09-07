(function () {
  "use strict";
  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    document.getElementById("error-banner").innerHTML =
      '<div class="banner banner-error">This browser could not load the ffmpeg.wasm engine (WebAssembly / SharedArrayBuffer support is required). Try a recent Chrome, Firefox, or Edge.</div>';
    return;
  }
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
  const resolutionSelect = document.getElementById("resolution-select");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const compareGrid = document.getElementById("compare-grid");

  let ffmpeg = null;
  let coreLoaded = false;
  let currentFile = null;
  let previewURL = null;
  let outputURLs = [];
  let busy = false;

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
    compareGrid.innerHTML = "";
    outputURLs.forEach(function (u) {
      URL.revokeObjectURL(u);
    });
    outputURLs = [];
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
  }

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
    const checks = Array.from(document.querySelectorAll(".level-check")).filter(function (c) {
      return c.checked;
    });
    if (checks.length === 0) {
      showError("Pick at least one compression level.");
      return;
    }
    clearError();
    resetOutput();
    busy = true;
    processBtn.disabled = true;
    logOutput.textContent = "";
    setProgress(0);

    const inExt = extName(currentFile.name);
    const inName = "input." + inExt;
    const maxHeight = parseInt(resolutionSelect.value, 10);

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      const results = [];
      for (let i = 0; i < checks.length; i++) {
        const crf = checks[i].dataset.crf;
        const label = checks[i].dataset.label;
        const outName = "output" + i + ".mp4";
        setStatus("Encoding " + label + " (" + (i + 1) + "/" + checks.length + ")…", true);
        setProgress(0);

        const args = ["-i", inName];
        if (maxHeight > 0) {
          args.push("-vf", "scale=-2:min(ih\\," + maxHeight + ")");
        }
        args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outName);

        const ret = await ffmpeg.exec(args);
        if (ret !== 0) {
          throw new Error("ffmpeg exited with code " + ret + " while encoding " + label + ". See the log below for details.");
        }
        const data = await ffmpeg.readFile(outName);
        const blob = new Blob([data.buffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        outputURLs.push(url);
        results.push({ label: label, size: blob.size, url: url });
        try {
          await ffmpeg.deleteFile(outName);
        } catch (_) {}
      }

      compareGrid.innerHTML = "";
      results.forEach(function (r) {
        const item = document.createElement("div");
        item.className = "compare-item";
        const reduction = 100 * (1 - r.size / currentFile.size);
        item.innerHTML =
          '<div class="compare-label"></div><div class="compare-size"></div>' +
          '<video controls style="width:100%"></video>' +
          '<div class="btn-row"><a class="btn btn-secondary" download>Download</a></div>';
        item.querySelector(".compare-label").textContent = r.label;
        item.querySelector(".compare-size").textContent =
          fmtBytes(r.size) + (reduction >= 0 ? " (" + reduction.toFixed(0) + "% smaller)" : " (larger than original)");
        item.querySelector("video").src = r.url;
        const a = item.querySelector("a");
        a.href = r.url;
        a.download = baseName(currentFile.name) + "-" + r.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".mp4";
        compareGrid.appendChild(item);
      });

      try {
        await ffmpeg.deleteFile(inName);
      } catch (_) {}

      outputCard.classList.add("visible");
      setStatus("Done.", false);
      setProgress(1);
    } catch (err) {
      showError((err && err.message) || String(err));
      setStatus("Failed.", false);
    } finally {
      busy = false;
      processBtn.disabled = false;
    }
  });
})();
