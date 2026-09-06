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
  const subInput = document.getElementById("sub-input");
  const fontsizeRange = document.getElementById("fontsize-range");
  const fontsizePill = document.getElementById("fontsize-pill");
  const subColor = document.getElementById("sub-color");
  const positionSelect = document.getElementById("position-select");
  const boxStyle = document.getElementById("box-style");
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
  let fontsWritten = false;
  let currentFile = null;
  let subFile = null;
  let previewURL = null;
  let outputURL = null;
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
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }
  // ASS wants &HAABBGGRR (alpha, then blue/green/red) from a normal #RRGGBB hex color.
  function hexToAss(hex, alphaHex) {
    const r = hex.slice(1, 3);
    const g = hex.slice(3, 5);
    const b = hex.slice(5, 7);
    return "&H" + alphaHex + b + g + r;
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
    outputName.value = baseName(file.name) + "-subtitled.mp4";
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";
  }

  subInput.addEventListener("change", function () {
    subFile = subInput.files[0] || null;
  });
  fontsizeRange.addEventListener("input", function () {
    fontsizePill.textContent = fontsizeRange.value + "px";
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
    if (!subFile) {
      showError("Choose a .srt or .vtt subtitle file first.");
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
    const subExt = extName(subFile.name) === "vtt" ? "vtt" : "srt";
    const subName = "subs." + subExt;

    try {
      await ensureFFmpeg();
      setStatus("Writing files into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));
      await ffmpeg.writeFile(subName, await fetchFile(subFile));
      if (!fontsWritten) {
        try {
          await ffmpeg.createDir("fonts");
        } catch (_) {}
        await ffmpeg.writeFile("fonts/DejaVuSans.ttf", await fetchFile(BASE_URL + "/DejaVuSans.ttf"));
        fontsWritten = true;
      }

      const primary = hexToAss(subColor.value, "00");
      const borderStyle = boxStyle.checked ? 4 : 1;
      const style = [
        "FontName=DejaVu Sans",
        "FontSize=" + fontsizeRange.value,
        "PrimaryColour=" + primary,
        "OutlineColour=&H00000000",
        "BackColour=&H80000000",
        "BorderStyle=" + borderStyle,
        "Outline=2",
        "Shadow=0",
        "Alignment=" + positionSelect.value,
        "MarginV=28",
      ].join(",");
      const vf = "subtitles=" + subName + ":fontsdir=fonts:force_style='" + style + "'";

      function buildArgs(withAudio) {
        const args = ["-i", inName, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23"];
        if (withAudio) args.push("-c:a", "aac");
        else args.push("-an");
        args.push("-movflags", "+faststart", outName);
        return args;
      }

      setStatus("Rendering subtitles…", true);
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
        await ffmpeg.deleteFile(subName);
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
