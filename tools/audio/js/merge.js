(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const { fmtBytes, decodeAudioBuffer, drawWaveform, setupWaveformBox } = window.AudioToolkit;
  const BASE_URL = "lib";

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileListEl = document.getElementById("file-list");
  const controlsCard = document.getElementById("controls-card");
  const formatSelect = document.getElementById("format-select");
  const bitrateField = document.getElementById("bitrate-field");
  const bitrateSelect = document.getElementById("bitrate-select");
  const outputName = document.getElementById("output-name");
  const processBtn = document.getElementById("process-btn");
  const statusLine = document.getElementById("status-line");
  const progressTrack = document.getElementById("progress-track");
  const progressFill = document.getElementById("progress-fill");
  const errorBanner = document.getElementById("error-banner");
  const logOutput = document.getElementById("log-output");
  const outputCard = document.getElementById("output-card");
  const outputAudio = document.getElementById("output-audio");
  const waveformWrap = document.getElementById("waveform-wrap");
  const waveformCanvas = document.getElementById("waveform");
  const waveformEmpty = document.getElementById("waveform-empty");
  const waveformBox = setupWaveformBox(waveformCanvas, waveformEmpty);
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  const CODECS = { mp3: "libmp3lame", wav: "pcm_s16le", ogg: "libvorbis", aac: "aac", flac: "flac" };
  const MIMES = { mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", flac: "audio/flac" };
  const HAS_BITRATE = { mp3: true, ogg: true, aac: true, wav: false, flac: false };

  let ffmpeg = null;
  let coreLoaded = false;
  let files = [];
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
  function extName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1) : "mp3";
  }
  function baseName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  function renderList() {
    fileListEl.innerHTML = "";
    files.forEach(function (f, i) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = i + 1 + ". " + f.name + " (" + fmtBytes(f.size) + ")";
      const controls = document.createElement("span");
      controls.style.display = "flex";
      controls.style.gap = "2px";

      const up = document.createElement("button");
      up.className = "remove";
      up.title = "Move up";
      up.textContent = "↑";
      up.disabled = i === 0;
      up.addEventListener("click", function () {
        [files[i - 1], files[i]] = [files[i], files[i - 1]];
        renderList();
      });

      const down = document.createElement("button");
      down.className = "remove";
      down.title = "Move down";
      down.textContent = "↓";
      down.disabled = i === files.length - 1;
      down.addEventListener("click", function () {
        [files[i + 1], files[i]] = [files[i], files[i + 1]];
        renderList();
      });

      const remove = document.createElement("button");
      remove.className = "remove";
      remove.title = "Remove";
      remove.textContent = "✕";
      remove.addEventListener("click", function () {
        files.splice(i, 1);
        renderList();
      });

      controls.append(up, down, remove);
      li.append(name, controls);
      fileListEl.appendChild(li);
    });
    controlsCard.style.display = files.length >= 2 ? "block" : "none";
    if (files.length === 1) {
      showError("Add at least one more clip to merge.");
    } else {
      clearError();
    }
  }

  function isAudioFile(file) {
    return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|wma|opus|aiff|webm)$/i.test(file.name);
  }

  function addFiles(list) {
    const arr = Array.from(list || []).filter(isAudioFile);
    if (arr.length === 0 && list && list.length) {
      showError("Those don't look like audio files.");
      return;
    }
    files = files.concat(arr);
    resetOutput();
    renderList();
  }

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    addFiles(fileInput.files);
    fileInput.value = "";
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
    addFiles(e.dataTransfer.files);
  });

  function syncFormatUI() {
    bitrateField.style.display = HAS_BITRATE[formatSelect.value] ? "block" : "none";
  }
  formatSelect.addEventListener("change", syncFormatUI);
  syncFormatUI();

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
    if (busy || files.length < 2) return;
    clearError();
    resetOutput();
    busy = true;
    processBtn.disabled = true;
    logOutput.textContent = "";
    setProgress(0);

    const format = formatSelect.value;
    const outName = "output." + format;
    const outNameValue = outputName.value.trim() || "merged";

    try {
      await ensureFFmpeg();
      const inputArgs = [];
      const labels = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const inName = "src" + i + "." + extName(f.name);
        setStatus("Writing clip " + (i + 1) + " of " + files.length + " into engine…", true);
        await ffmpeg.writeFile(inName, await fetchFile(f));
        inputArgs.push("-i", inName);
        labels.push("[" + i + ":a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a" + i + "]");
      }
      const concatInputs = files.map(function (_, i) {
        return "[a" + i + "]";
      }).join("");
      const filterComplex = labels.join(";") + ";" + concatInputs + "concat=n=" + files.length + ":v=0:a=1[aout]";

      const args = inputArgs.concat(["-filter_complex", filterComplex, "-map", "[aout]", "-c:a", CODECS[format]]);
      if (HAS_BITRATE[format]) args.push("-b:a", bitrateSelect.value);
      args.push(outName);

      setStatus("Merging " + files.length + " clips…", true);
      setProgress(0);
      const ret = await ffmpeg.exec(args);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
      }

      const data = await ffmpeg.readFile(outName);
      const blob = new Blob([data.buffer], { type: MIMES[format] });
      outputURL = URL.createObjectURL(blob);
      outputAudio.src = outputURL;
      outputSize.textContent = fmtBytes(blob.size);
      downloadLink.href = outputURL;
      downloadLink.download = baseName(outNameValue) + "." + format;
      outputCard.classList.add("visible");
      setStatus("Done.", false);
      setProgress(1);

      waveformWrap.style.display = "block";
      waveformBox.loading();
      decodeAudioBuffer(blob)
        .then(function (buf) {
          waveformBox.ready();
          drawWaveform(waveformCanvas, buf);
        })
        .catch(function () {
          waveformBox.error("Waveform preview unavailable for this file.");
        });

      try {
        for (let i = 0; i < files.length; i++) await ffmpeg.deleteFile("src" + i + "." + extName(files[i].name));
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
