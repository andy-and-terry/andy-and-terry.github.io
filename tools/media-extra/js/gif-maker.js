(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const BASE_URL = "lib";

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }
  function baseName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(0, dot) : name;
  }
  function extName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1) : "mp4";
  }
  function fmtTime(s) {
    if (!isFinite(s)) return "0:00.0";
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(1);
    return m + ":" + (sec.length < 4 ? "0" + sec : sec);
  }

  if (!window.FFmpegWASM || !window.FFmpegUtil) {
    document.getElementById("video-error-banner").innerHTML =
      '<div class="banner banner-error">This browser could not load the ffmpeg.wasm engine (WebAssembly / SharedArrayBuffer support is required). Try a recent Chrome, Firefox, or Edge.</div>';
    return;
  }

  let ffmpeg = null;
  let coreLoaded = false;
  let busy = false;
  let outputURL = null;

  const outputCard = document.getElementById("output-card");
  const outputImage = document.getElementById("output-image");
  const outputSize = document.getElementById("output-size");
  const downloadLink = document.getElementById("download-link");

  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  async function ensureFFmpeg(setStatus, setProgress, appendLog, progressTrack, progressFill) {
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

  function finishOutput(blob, filename) {
    resetOutput();
    outputURL = URL.createObjectURL(blob);
    outputImage.src = outputURL;
    outputSize.textContent = fmtBytes(blob.size);
    downloadLink.href = outputURL;
    downloadLink.download = filename;
    outputCard.classList.add("visible");
  }

  // ---------- Mode toggle ----------
  const modeVideoBtn = document.getElementById("mode-video-btn");
  const modeImagesBtn = document.getElementById("mode-images-btn");
  const videoMode = document.getElementById("video-mode");
  const imagesMode = document.getElementById("images-mode");

  function setMode(mode) {
    const isVideo = mode === "video";
    modeVideoBtn.classList.toggle("active", isVideo);
    modeVideoBtn.setAttribute("aria-selected", String(isVideo));
    modeImagesBtn.classList.toggle("active", !isVideo);
    modeImagesBtn.setAttribute("aria-selected", String(!isVideo));
    videoMode.style.display = isVideo ? "block" : "none";
    imagesMode.style.display = isVideo ? "none" : "block";
    resetOutput();
  }
  modeVideoBtn.addEventListener("click", function () {
    setMode("video");
  });
  modeImagesBtn.addEventListener("click", function () {
    setMode("images");
  });

  // ============== VIDEO -> GIF ==============
  (function () {
    const dropZone = document.getElementById("video-drop-zone");
    const fileInput = document.getElementById("video-file-input");
    const fileInfo = document.getElementById("video-file-info");
    const fileNameEl = document.getElementById("video-file-name");
    const fileSizeEl = document.getElementById("video-file-size");
    const preview = document.getElementById("video-preview");
    const controlsCard = document.getElementById("video-controls-card");
    const startRange = document.getElementById("start-range");
    const endRange = document.getElementById("end-range");
    const startPill = document.getElementById("start-pill");
    const endPill = document.getElementById("end-pill");
    const fpsRange = document.getElementById("fps-range");
    const fpsPill = document.getElementById("fps-pill");
    const widthSelect = document.getElementById("width-select");
    const loopCheck = document.getElementById("loop-check");
    const outputName = document.getElementById("video-output-name");
    const processBtn = document.getElementById("video-process-btn");
    const statusLine = document.getElementById("video-status-line");
    const progressTrack = document.getElementById("video-progress-track");
    const progressFill = document.getElementById("video-progress-fill");
    const errorBanner = document.getElementById("video-error-banner");
    const logOutput = document.getElementById("video-log-output");
    const setStartBtn = document.getElementById("set-start-btn");
    const setEndBtn = document.getElementById("set-end-btn");

    let currentFile = null;
    let previewURL = null;
    let duration = 0;

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
      outputName.value = baseName(file.name) + ".gif";
      controlsCard.style.display = "block";
      setStatus("");
      logOutput.textContent = "";

      preview.onloadedmetadata = function () {
        duration = preview.duration || 0;
        startRange.max = duration;
        endRange.max = duration;
        startRange.value = 0;
        endRange.value = Math.min(duration, 5);
        updatePills();
      };
    }

    function updatePills() {
      let start = parseFloat(startRange.value);
      let end = parseFloat(endRange.value);
      if (start > end) {
        start = end;
        startRange.value = start;
      }
      startPill.textContent = fmtTime(start);
      endPill.textContent = fmtTime(end);
    }
    startRange.addEventListener("input", updatePills);
    endRange.addEventListener("input", updatePills);
    fpsRange.addEventListener("input", function () {
      fpsPill.textContent = fpsRange.value;
    });

    setStartBtn.addEventListener("click", function () {
      startRange.value = preview.currentTime;
      updatePills();
    });
    setEndBtn.addEventListener("click", function () {
      endRange.value = preview.currentTime;
      updatePills();
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

    processBtn.addEventListener("click", async function () {
      if (busy || !currentFile) return;
      const start = parseFloat(startRange.value);
      const end = parseFloat(endRange.value);
      if (!(end > start)) {
        showError("End time must be after the start time.");
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
      const outName = "output.gif";
      const outNameValue = outputName.value.trim() || "output.gif";

      try {
        await ensureFFmpeg(setStatus, setProgress, appendLog, progressTrack, progressFill);
        setStatus("Writing file into engine…", true);
        await ffmpeg.writeFile(inName, await fetchFile(currentFile));

        const fps = fpsRange.value;
        const width = widthSelect.value;
        const scale = width === "0" ? "iw:ih" : width + ":-1";
        const filter =
          "fps=" + fps + ",scale=" + scale + ":flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer";
        const loopVal = loopCheck.checked ? "0" : "-1";

        const args = [
          "-ss",
          start.toFixed(3),
          "-to",
          end.toFixed(3),
          "-i",
          inName,
          "-vf",
          filter,
          "-loop",
          loopVal,
          outName,
        ];

        setStatus("Generating GIF (palette pass + render)…", true);
        const ret = await ffmpeg.exec(args);
        if (ret !== 0) {
          throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
        }

        const data = await ffmpeg.readFile(outName);
        const blob = new Blob([data.buffer], { type: "image/gif" });
        finishOutput(blob, baseName(outNameValue) + ".gif");
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

  // ============== IMAGES -> GIF ==============
  (function () {
    const dropZone = document.getElementById("images-drop-zone");
    const fileInput = document.getElementById("images-file-input");
    const listEl = document.getElementById("images-list");
    const controlsCard = document.getElementById("images-controls-card");
    const delayRange = document.getElementById("delay-range");
    const delayPill = document.getElementById("delay-pill");
    const widthSelect = document.getElementById("images-width-select");
    const loopCheck = document.getElementById("images-loop-check");
    const outputName = document.getElementById("images-output-name");
    const processBtn = document.getElementById("images-process-btn");
    const statusLine = document.getElementById("images-status-line");
    const progressTrack = document.getElementById("images-progress-track");
    const progressFill = document.getElementById("images-progress-fill");
    const errorBanner = document.getElementById("images-error-banner");
    const logOutput = document.getElementById("images-log-output");

    let files = [];

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

    function renderList() {
      listEl.innerHTML = "";
      files.forEach(function (f, i) {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "name";
        name.textContent = i + 1 + ". " + f.name;
        const btn = document.createElement("button");
        btn.className = "remove";
        btn.type = "button";
        btn.textContent = "×";
        btn.setAttribute("aria-label", "Remove " + f.name);
        btn.addEventListener("click", function () {
          files.splice(i, 1);
          renderList();
        });
        li.appendChild(name);
        li.appendChild(btn);
        listEl.appendChild(li);
      });
      controlsCard.style.display = files.length >= 2 ? "block" : "none";
      if (files.length > 0 && files.length < 2) {
        showError("Add at least 2 images to make an animated GIF.");
      } else {
        clearError();
      }
    }

    function addFiles(fileList) {
      const imgs = Array.from(fileList || []).filter(function (f) {
        return f.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name);
      });
      if (imgs.length === 0) {
        showError("Those don't look like image files.");
        return;
      }
      clearError();
      resetOutput();
      imgs.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      files = files.concat(imgs);
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

    delayRange.addEventListener("input", function () {
      delayPill.textContent = delayRange.value;
    });

    processBtn.addEventListener("click", async function () {
      if (busy || files.length < 2) return;
      clearError();
      resetOutput();
      busy = true;
      processBtn.disabled = true;
      logOutput.textContent = "";
      setProgress(0);

      const outName = "output.gif";
      const outNameValue = outputName.value.trim() || "output.gif";
      const writtenNames = [];

      try {
        await ensureFFmpeg(setStatus, setProgress, appendLog, progressTrack, progressFill);
        setStatus("Writing images into engine…", true);
        for (let i = 0; i < files.length; i++) {
          const ext = extName(files[i].name).toLowerCase();
          const name = "img" + String(i).padStart(5, "0") + "." + (ext || "png");
          await ffmpeg.writeFile(name, await fetchFile(files[i]));
          writtenNames.push(name);
        }

        const fps = (1000 / parseFloat(delayRange.value)).toFixed(4);
        const width = widthSelect.value;
        const scale = width === "0" ? "iw:ih" : width + ":-1";
        const filter =
          "fps=" + fps + ",scale=" + scale + ":flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer";
        const loopVal = loopCheck.checked ? "0" : "-1";
        const firstExt = extName(files[0].name).toLowerCase() || "png";

        const args = [
          "-framerate",
          (1000 / parseFloat(delayRange.value)).toFixed(4),
          "-i",
          "img%05d." + firstExt,
          "-vf",
          filter,
          "-loop",
          loopVal,
          outName,
        ];

        setStatus("Generating GIF (palette pass + render)…", true);
        const ret = await ffmpeg.exec(args);
        if (ret !== 0) {
          throw new Error(
            "ffmpeg exited with code " +
              ret +
              ". Make sure all selected images share the same file format (e.g. all .png or all .jpg). See the log below for details."
          );
        }

        const data = await ffmpeg.readFile(outName);
        const blob = new Blob([data.buffer], { type: "image/gif" });
        finishOutput(blob, baseName(outNameValue) + ".gif");
        setStatus("Done.", false);
        setProgress(1);

        try {
          for (const n of writtenNames) await ffmpeg.deleteFile(n);
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
})();
