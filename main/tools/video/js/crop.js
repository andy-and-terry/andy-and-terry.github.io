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
  const cropStage = document.getElementById("crop-stage");
  const preview = document.getElementById("preview");
  const cropBox = document.getElementById("crop-box");
  const cropHandle = document.getElementById("crop-handle");
  const controlsCard = document.getElementById("controls-card");
  const cropDims = document.getElementById("crop-dims");
  const outputName = document.getElementById("output-name");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const outputPreview = document.getElementById("output-preview");
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  let ffmpeg = null;
  let coreLoaded = false;
  let currentFile = null;
  let previewURL = null;
  let outputURL = null;
  let busy = false;

  // crop rect in percent of displayed video (0-100)
  let rect = { x: 12.5, y: 12.5, w: 75, h: 75 };

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

  function renderCropBox() {
    cropBox.style.left = rect.x + "%";
    cropBox.style.top = rect.y + "%";
    cropBox.style.width = rect.w + "%";
    cropBox.style.height = rect.h + "%";
    const vw = preview.videoWidth || 0;
    const vh = preview.videoHeight || 0;
    if (vw && vh) {
      const pw = evenify(Math.round((vw * rect.w) / 100));
      const ph = evenify(Math.round((vh * rect.h) / 100));
      const px = Math.round((vw * rect.x) / 100);
      const py = Math.round((vh * rect.y) / 100);
      cropDims.textContent = pw + " × " + ph + " px, starting at (" + px + ", " + py + ")";
    }
  }

  function evenify(n) {
    return n % 2 === 0 ? n : n - 1;
  }

  function clampRect() {
    rect.w = Math.max(5, Math.min(100, rect.w));
    rect.h = Math.max(5, Math.min(100, rect.h));
    rect.x = Math.max(0, Math.min(100 - rect.w, rect.x));
    rect.y = Math.max(0, Math.min(100 - rect.h, rect.y));
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
    cropStage.style.display = "inline-block";
    fileInfo.style.display = "flex";
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = fmtBytes(file.size);
    outputName.value = baseName(file.name) + "-cropped.mp4";
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";
    rect = { x: 12.5, y: 12.5, w: 75, h: 75 };

    preview.onloadedmetadata = function () {
      preview.currentTime = Math.min(0.5, preview.duration || 0);
      renderCropBox();
    };
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

  // drag to move, corner handle to resize
  let dragMode = null;
  let dragStart = null;

  function startDrag(mode, e) {
    dragMode = mode;
    const stageRect = cropStage.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    dragStart = {
      px: p.clientX,
      py: p.clientY,
      stageW: stageRect.width,
      stageH: stageRect.height,
      rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    };
    e.preventDefault();
  }

  cropBox.addEventListener("pointerdown", function (e) {
    if (e.target === cropHandle) return;
    startDrag("move", e);
    cropBox.setPointerCapture(e.pointerId);
  });
  cropHandle.addEventListener("pointerdown", function (e) {
    e.stopPropagation();
    startDrag("resize", e);
    cropHandle.setPointerCapture(e.pointerId);
  });

  window.addEventListener("pointermove", function (e) {
    if (!dragMode) return;
    const dx = ((e.clientX - dragStart.px) / dragStart.stageW) * 100;
    const dy = ((e.clientY - dragStart.py) / dragStart.stageH) * 100;
    if (dragMode === "move") {
      rect.x = dragStart.rect.x + dx;
      rect.y = dragStart.rect.y + dy;
    } else if (dragMode === "resize") {
      rect.w = dragStart.rect.w + dx;
      rect.h = dragStart.rect.h + dy;
    }
    clampRect();
    renderCropBox();
  });
  window.addEventListener("pointerup", function () {
    dragMode = null;
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
    const vw = preview.videoWidth;
    const vh = preview.videoHeight;
    if (!vw || !vh) {
      showError("Video dimensions aren't ready yet — wait for the preview to load.");
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
    const outName = "output.mp4";
    const outNameValue = outputName.value.trim() || "output.mp4";

    const cw = evenify(Math.max(2, Math.round((vw * rect.w) / 100)));
    const ch = evenify(Math.max(2, Math.round((vh * rect.h) / 100)));
    const cx = Math.round((vw * rect.x) / 100);
    const cy = Math.round((vh * rect.y) / 100);
    const vf = "crop=" + cw + ":" + ch + ":" + cx + ":" + cy;

    function buildArgs(withAudio) {
      const args = ["-i", inName, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23"];
      if (withAudio) args.push("-c:a", "aac");
      else args.push("-an");
      args.push("-movflags", "+faststart", outName);
      return args;
    }

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      setStatus("Cropping…", true);
      let ret = await ffmpeg.exec(buildArgs(true));
      if (ret !== 0) {
        appendLog("(retrying without audio — the source clip likely has no audio track)");
        try {
          await ffmpeg.deleteFile(outName);
        } catch (_) {}
        setProgress(0);
        ret = await ffmpeg.exec(buildArgs(false));
      }
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
      }

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      outputURL = URL.createObjectURL(blob);
      outputPreview.src = outputURL;
      outputSize.textContent = fmtBytes(blob.size);
      downloadLink.href = outputURL;
      downloadLink.download = baseName(outNameValue) + ".mp4";
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
