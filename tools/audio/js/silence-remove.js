(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const { fmtBytes, fmtTime, decodeAudioBuffer, drawWaveform, setupWaveformBox } = window.AudioToolkit;
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
  const thresholdRange = document.getElementById("threshold-range");
  const thresholdPill = document.getElementById("threshold-pill");
  const minDurRange = document.getElementById("min-dur-range");
  const minDurPill = document.getElementById("min-dur-pill");
  const internalCheck = document.getElementById("internal-check");
  const outputName = document.getElementById("output-name");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const outputAudio = document.getElementById("output-audio");
  const outputSize = document.getElementById("output-size");
  const outputSavings = document.getElementById("output-savings");
  const downloadLink = document.getElementById("download-link");

  // extension -> [outputExt, codec, mime]; anything unrecognized falls back to WAV.
  const EXT_MAP = {
    mp3: ["mp3", "libmp3lame", "audio/mpeg"],
    wav: ["wav", "pcm_s16le", "audio/wav"],
    ogg: ["ogg", "libvorbis", "audio/ogg"],
    oga: ["ogg", "libvorbis", "audio/ogg"],
    m4a: ["aac", "aac", "audio/aac"],
    aac: ["aac", "aac", "audio/aac"],
    flac: ["flac", "flac", "audio/flac"],
  };
  const FALLBACK = ["wav", "pcm_s16le", "audio/wav"];

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
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    outputSavings.textContent = "";
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  function isAudioFile(file) {
    return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|wma|opus|aiff|webm)$/i.test(file.name);
  }

  let sourceDuration = 0;

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
    outputName.value = baseName(file.name) + "-trimmed." + ((EXT_MAP[extName(file.name)] || FALLBACK)[0]);
    controlsCard.style.display = "block";
    setStatus("");
    logOutput.textContent = "";

    preview.onloadedmetadata = function () {
      sourceDuration = preview.duration || 0;
    };

    waveformWrap.style.display = "block";
    waveformBox.loading();
    decodeAudioBuffer(file)
      .then(function (buf) {
        waveformBox.ready();
        drawWaveform(waveformCanvas, buf);
      })
      .catch(function () {
        waveformBox.error("Waveform preview unavailable for this file — silence removal still works.");
      });
  }

  function updatePills() {
    thresholdPill.textContent = thresholdRange.value + " dB";
    minDurPill.textContent = parseFloat(minDurRange.value).toFixed(1) + "s";
  }
  thresholdRange.addEventListener("input", updatePills);
  minDurRange.addEventListener("input", updatePills);
  updatePills();

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

  function getOutputDuration(url) {
    return new Promise(function (resolve) {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = function () {
        resolve(a.duration || 0);
      };
      a.onerror = function () {
        resolve(0);
      };
      a.src = url;
    });
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
    const inName = "input." + (inExt || "dat");
    const [outExt, codec, mime] = EXT_MAP[inExt] || FALLBACK;
    const outName = "output." + outExt;
    const outNameValue = outputName.value.trim() || "output." + outExt;
    const threshold = thresholdRange.value + "dB";
    const minDur = parseFloat(minDurRange.value).toFixed(2);
    const stopPeriods = internalCheck.checked ? -1 : 1;

    const filter =
      "silenceremove=start_periods=1:start_threshold=" +
      threshold +
      ":start_duration=" +
      minDur +
      ":start_silence=0.1:stop_periods=" +
      stopPeriods +
      ":stop_threshold=" +
      threshold +
      ":stop_duration=" +
      minDur +
      ":stop_silence=0.1";

    try {
      await ensureFFmpeg();
      setStatus("Writing file into engine…", true);
      await ffmpeg.writeFile(inName, await fetchFile(currentFile));

      setStatus("Detecting and removing silence…", true);
      const ret = await ffmpeg.exec(["-i", inName, "-af", filter, "-c:a", codec, outName]);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
      }

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([data.buffer], { type: mime });
      outputURL = URL.createObjectURL(blob);
      outputAudio.src = outputURL;
      outputSize.textContent = fmtBytes(blob.size);
      downloadLink.href = outputURL;
      downloadLink.download = baseName(outNameValue) + "." + outExt;
      outputCard.classList.add("visible");

      const newDuration = await getOutputDuration(outputURL);
      if (sourceDuration > 0 && newDuration > 0) {
        const removed = Math.max(0, sourceDuration - newDuration);
        const pct = Math.round((removed / sourceDuration) * 100);
        outputSavings.textContent = "Removed " + fmtTime(removed) + " of silence (" + pct + "%)";
      }

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
