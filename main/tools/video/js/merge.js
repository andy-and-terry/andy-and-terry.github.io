(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const BASE_URL = "lib";

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const fileListEl = document.getElementById("file-list");
  const controlsCard = document.getElementById("controls-card");
  const resolutionSelect = document.getElementById("resolution-select");
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
  let files = [];
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
  function extName(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1) : "mp4";
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

  function addFiles(list) {
    const arr = Array.from(list || []).filter(function (f) {
      return f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v|flv|wmv)$/i.test(f.name);
    });
    if (arr.length === 0 && list && list.length) {
      showError("Those don't look like video files.");
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

  async function hasAudioStream(inName) {
    try {
      await ffmpeg.ffprobe([
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "csv=p=0",
        inName,
        "-o", "probe.txt",
      ]);
      const data = await ffmpeg.readFile("probe.txt", "utf8");
      try {
        await ffmpeg.deleteFile("probe.txt");
      } catch (_) {}
      return typeof data === "string" && data.trim().length > 0;
    } catch (_) {
      return false;
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

    const [targetW, targetH] = resolutionSelect.value.split("x").map(Number);
    const outNameValue = outputName.value.trim() || "merged.mp4";
    const vf =
      "scale=" +
      targetW +
      ":" +
      targetH +
      ":force_original_aspect_ratio=decrease,pad=" +
      targetW +
      ":" +
      targetH +
      ":(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30";

    try {
      await ensureFFmpeg();
      const segNames = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const inExt = extName(f.name);
        const inName = "src" + i + "." + inExt;
        const segName = "seg" + i + ".ts";

        setStatus("Writing clip " + (i + 1) + " of " + files.length + " into engine…", true);
        await ffmpeg.writeFile(inName, await fetchFile(f));

        setStatus("Checking clip " + (i + 1) + " for audio…", true);
        const hasAudio = await hasAudioStream(inName);

        let args;
        if (hasAudio) {
          args = [
            "-i", inName,
            "-vf", vf,
            "-map", "0:v:0",
            "-map", "0:a:0",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            segName,
          ];
        } else {
          args = [
            "-i", inName,
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-vf", vf,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            segName,
          ];
        }

        setStatus("Normalizing clip " + (i + 1) + " of " + files.length + "…", true);
        setProgress(0);
        const ret = await ffmpeg.exec(args);
        if (ret !== 0) {
          throw new Error("ffmpeg exited with code " + ret + " while processing \"" + f.name + "\". See the log below for details.");
        }
        segNames.push(segName);
        try {
          await ffmpeg.deleteFile(inName);
        } catch (_) {}
      }

      const listContent = segNames.map((n) => "file '" + n + "'").join("\n");
      await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(listContent));

      setStatus("Joining " + segNames.length + " clips…", true);
      setProgress(0);
      const ret = await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat_list.txt",
        "-c", "copy",
        "-movflags", "+faststart",
        "output.mp4",
      ]);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + " while joining clips. See the log below for details.");
      }

      const data = await ffmpeg.readFile("output.mp4");
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
        for (const n of segNames) await ffmpeg.deleteFile(n);
        await ffmpeg.deleteFile("concat_list.txt");
        await ffmpeg.deleteFile("output.mp4");
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
