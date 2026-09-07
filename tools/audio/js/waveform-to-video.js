(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const { fmtBytes, decodeAudioBuffer, drawWaveform, setupWaveformBox } = window.AudioToolkit;
  const BASE_URL = "lib";

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileInfo = document.getElementById("file-info");
  const fileNameEl = document.getElementById("file-name");
  const fileSizeEl = document.getElementById("file-size");
  const preview = document.getElementById("preview");
  const waveformWrap = document.getElementById("waveform-wrap");
  const waveformCanvas = document.getElementById("waveform");
  const waveformEmpty = document.getElementById("waveform-empty");
  const waveformBox = setupWaveformBox(waveformCanvas, waveformEmpty);
  const controlsCard = document.getElementById("controls-card");
  const resolutionSelect = document.getElementById("resolution-select");
  const modeSelect = document.getElementById("mode-select");
  const waveColor = document.getElementById("wave-color");
  const bgColor = document.getElementById("bg-color");
  const fpsSelect = document.getElementById("fps-select");
  const splitChannels = document.getElementById("split-channels");
  const outputName = document.getElementById("output-name");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const outputVideo = document.getElementById("output-video");
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  let ffmpeg = null;
  let coreLoaded = false;
  let currentFile = null;
  let previewURL = null;
  let outputURL = null;
  let busy = false;

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
    return dot > 0 ? name.slice(dot + 1) : "mp3";
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }
  function hexToFFColor(hex) {
    return "0x" + hex.replace("#", "");
  }

  function isAudioFile(file) {
    return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|wma|opus|aiff|webm)$/i.test(file.name);
  }

  function handleFile(file) {
    if (!file) return;
    if (!isAudioFile(file)) {
      showError("That doesn't look like an audio file.");
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
    outputName.value = baseName(file.name) + "-waveform.mp4";
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";

    waveformWrap.style.display = "block";
    waveformBox.loading();
    decodeAudioBuffer(file)
      .then(function (buf) {
        waveformBox.ready();
        drawWaveform(waveformCanvas, buf, { color: waveColor.value });
      })
      .catch(function () {
        waveformBox.error("Waveform preview unavailable for this file — rendering still works.");
      });
  }

  waveColor.addEventListener("input", function () {
    if (currentFile) decodeAudioBuffer(currentFile).then(function (buf) {
      drawWaveform(waveformCanvas, buf, { color: waveColor.value });
    });
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
    const size = resolutionSelect.value;
    const fps = fpsSelect.value;
    const mode = modeSelect.value;
    const wc = hexToFFColor(waveColor.value);
    const bc = hexToFFColor(bgColor.value);
    const split = splitChannels.checked ? 1 : 0;

    const filterComplex =
      "color=size=" +
      size +
      ":color=" +
      bc +
      ":rate=" +
      fps +
      "[bg];" +
      "[0:a]showwaves=s=" +
      size +
      ":mode=" +
      mode +
      ":colors=" +
      wc +
      ":rate=" +
      fps +
      ":scale=sqrt:split_channels=" +
      split +
      "[wave];" +
      "[bg][wave]overlay=shortest=1[v]";

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      setStatus("Rendering waveform video…", true);
      const ret = await ffmpeg.exec([
        "-i",
        inName,
        "-filter_complex",
        filterComplex,
        "-map",
        "[v]",
        "-map",
        "0:a",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        outName,
      ]);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
      }

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      outputURL = URL.createObjectURL(blob);
      outputVideo.src = outputURL;
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
