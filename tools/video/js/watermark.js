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
  const modeSelect = document.getElementById("mode-select");
  const textFields = document.getElementById("text-fields");
  const imageFields = document.getElementById("image-fields");
  const wmText = document.getElementById("wm-text");
  const fontsizeRange = document.getElementById("fontsize-range");
  const fontsizePill = document.getElementById("fontsize-pill");
  const wmColor = document.getElementById("wm-color");
  const wmBox = document.getElementById("wm-box");
  const logoInput = document.getElementById("logo-input");
  const wmwidthRange = document.getElementById("wmwidth-range");
  const wmwidthPill = document.getElementById("wmwidth-pill");
  const opacityRange = document.getElementById("opacity-range");
  const opacityPill = document.getElementById("opacity-pill");
  const positionGrid = document.getElementById("position-grid");
  const marginRange = document.getElementById("margin-range");
  const marginPill = document.getElementById("margin-pill");
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
  let logoFile = null;
  let previewURL = null;
  let outputURL = null;
  let busy = false;
  let position = "bottom-right";

  const POSITIONS = [
    ["top-left", "↖"],
    ["top-center", "↑"],
    ["top-right", "↗"],
    ["center-left", "←"],
    ["center", "•"],
    ["center-right", "→"],
    ["bottom-left", "↙"],
    ["bottom-center", "↓"],
    ["bottom-right", "↘"],
  ];
  const POS_EXPR = {
    "top-left": { ox: "M", oy: "M", tx: "M", ty: "M" },
    "top-center": { ox: "(main_w-w)/2", oy: "M", tx: "(w-text_w)/2", ty: "M" },
    "top-right": { ox: "main_w-w-M", oy: "M", tx: "w-text_w-M", ty: "M" },
    "center-left": { ox: "M", oy: "(main_h-h)/2", tx: "M", ty: "(h-text_h)/2" },
    center: { ox: "(main_w-w)/2", oy: "(main_h-h)/2", tx: "(w-text_w)/2", ty: "(h-text_h)/2" },
    "center-right": { ox: "main_w-w-M", oy: "(main_h-h)/2", tx: "w-text_w-M", ty: "(h-text_h)/2" },
    "bottom-left": { ox: "M", oy: "main_h-h-M", tx: "M", ty: "h-text_h-M" },
    "bottom-center": { ox: "(main_w-w)/2", oy: "main_h-h-M", tx: "(w-text_w)/2", ty: "h-text_h-M" },
    "bottom-right": { ox: "main_w-w-M", oy: "main_h-h-M", tx: "w-text_w-M", ty: "h-text_h-M" },
  };

  POSITIONS.forEach(function (p) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-secondary";
    btn.textContent = p[1];
    btn.style.width = "60px";
    btn.dataset.pos = p[0];
    if (p[0] === position) btn.style.borderColor = "var(--accent)";
    btn.addEventListener("click", function () {
      position = p[0];
      positionGrid.querySelectorAll("button").forEach(function (b) {
        b.style.borderColor = b.dataset.pos === position ? "var(--accent)" : "";
      });
    });
    positionGrid.appendChild(btn);
  });

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
  function escapeDrawtext(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
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
    outputName.value = baseName(file.name) + "-watermarked.mp4";
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";
  }

  logoInput.addEventListener("change", function () {
    logoFile = logoInput.files[0] || null;
  });

  function syncModeUI() {
    const isImage = modeSelect.value === "image";
    textFields.style.display = isImage ? "none" : "block";
    imageFields.style.display = isImage ? "block" : "none";
  }
  modeSelect.addEventListener("change", syncModeUI);
  syncModeUI();

  fontsizeRange.addEventListener("input", function () {
    fontsizePill.textContent = fontsizeRange.value + "px";
  });
  wmwidthRange.addEventListener("input", function () {
    wmwidthPill.textContent = wmwidthRange.value + "%";
  });
  opacityRange.addEventListener("input", function () {
    opacityPill.textContent = opacityRange.value + "%";
  });
  marginRange.addEventListener("input", function () {
    marginPill.textContent = marginRange.value + "px";
  });

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
    const isImage = modeSelect.value === "image";
    if (isImage && !logoFile) {
      showError("Choose a logo image first.");
      return;
    }
    if (!isImage && !wmText.value.trim()) {
      showError("Enter some watermark text first.");
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
    const margin = marginRange.value;
    const opacity = (parseInt(opacityRange.value, 10) / 100).toFixed(2);
    const pos = POS_EXPR[position];

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      let args;
      if (isImage) {
        const logoExt = extName(logoFile.name) || "png";
        const logoName = "logo." + logoExt;
        await ffmpeg.writeFile(logoName, await fetchFile(logoFile));
        const vw = preview.videoWidth || 1280;
        const wmWidthPx = Math.max(8, Math.round((vw * parseInt(wmwidthRange.value, 10)) / 100));
        const ox = pos.ox.replace(/M/g, margin);
        const oy = pos.oy.replace(/M/g, margin);
        const filter =
          "[1:v]scale=" +
          wmWidthPx +
          ":-2,format=rgba,colorchannelmixer=aa=" +
          opacity +
          "[wm];[0:v][wm]overlay=" +
          ox +
          ":" +
          oy +
          "[v]";
        args = [
          "-i",
          inName,
          "-loop",
          "1",
          "-i",
          logoName,
          "-filter_complex",
          filter,
          "-map",
          "[v]",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-shortest",
          "-movflags",
          "+faststart",
          outName,
        ];
      } else {
        await ffmpeg.writeFile("font.ttf", await fetchFile(BASE_URL + "/DejaVuSans.ttf"));
        const hex = wmColor.value.replace("#", "0x");
        const tx = pos.tx.replace(/M/g, margin);
        const ty = pos.ty.replace(/M/g, margin);
        let drawtext =
          "drawtext=fontfile=font.ttf:text='" +
          escapeDrawtext(wmText.value) +
          "':fontsize=" +
          fontsizeRange.value +
          ":fontcolor=" +
          hex +
          "@" +
          opacity +
          ":x=" +
          tx +
          ":y=" +
          ty;
        if (wmBox.checked) {
          drawtext += ":box=1:boxcolor=black@0.35:boxborderw=10";
        }
        args = [
          "-i",
          inName,
          "-vf",
          drawtext,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outName,
        ];
      }

      setStatus("Rendering watermark…", true);
      const ret = await ffmpeg.exec(args);
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
