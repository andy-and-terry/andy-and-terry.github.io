(function () {
  "use strict";
  const { FFmpeg } = FFmpegWASM;
  const { fetchFile, toBlobURL } = FFmpegUtil;
  const BASE_URL = "lib";

  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const thumbGrid = document.getElementById("thumb-grid");
  const controlsCard = document.getElementById("controls-card");
  const durationRange = document.getElementById("duration-range");
  const durationPill = document.getElementById("duration-pill");
  const resolutionSelect = document.getElementById("resolution-select");
  const fadeCheck = document.getElementById("fade-check");
  const musicCheck = document.getElementById("music-check");
  const musicField = document.getElementById("music-field");
  const musicInput = document.getElementById("music-input");
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
  let images = [];
  let musicFile = null;
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
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "jpg";
  }
  function resetOutput() {
    outputCard.classList.remove("visible");
    if (outputURL) {
      URL.revokeObjectURL(outputURL);
      outputURL = null;
    }
  }

  function renderThumbs() {
    thumbGrid.innerHTML = "";
    images.forEach(function (f, i) {
      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      img.onload = function () {
        URL.revokeObjectURL(img.src);
      };
      const remove = document.createElement("button");
      remove.textContent = "✕";
      remove.className = "btn btn-secondary";
      remove.style.cssText = "position:absolute;top:4px;right:4px;padding:2px 8px;font-size:11px";
      remove.addEventListener("click", function () {
        images.splice(i, 1);
        renderThumbs();
      });
      wrap.append(img, remove);
      thumbGrid.appendChild(wrap);
    });
    controlsCard.style.display = images.length >= 1 ? "block" : "none";
  }

  function addImages(list) {
    const arr = Array.from(list || []).filter(function (f) {
      return f.type.startsWith("image/");
    });
    images = images.concat(arr);
    resetOutput();
    renderThumbs();
  }

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    addImages(fileInput.files);
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
    addImages(e.dataTransfer.files);
  });

  durationRange.addEventListener("input", function () {
    durationPill.textContent = parseFloat(durationRange.value) + "s";
  });
  musicCheck.addEventListener("change", function () {
    musicField.style.display = musicCheck.checked ? "block" : "none";
  });
  musicInput.addEventListener("change", function () {
    musicFile = musicInput.files[0] || null;
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
    if (busy || images.length === 0) return;
    clearError();
    resetOutput();
    busy = true;
    processBtn.disabled = true;
    logOutput.textContent = "";
    setProgress(0);

    const [targetW, targetH] = resolutionSelect.value.split("x").map(Number);
    const perPhoto = parseFloat(durationRange.value);
    const outNameValue = outputName.value.trim() || "slideshow.mp4";
    const fadeDur = Math.min(0.6, perPhoto / 3);

    let vf =
      "scale=" +
      targetW +
      ":" +
      targetH +
      ":force_original_aspect_ratio=decrease,pad=" +
      targetW +
      ":" +
      targetH +
      ":(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30";
    if (fadeCheck.checked) {
      vf += ",fade=t=in:st=0:d=" + fadeDur + ",fade=t=out:st=" + (perPhoto - fadeDur).toFixed(2) + ":d=" + fadeDur;
    }

    try {
      await ensureFFmpeg();
      const segNames = [];

      for (let i = 0; i < images.length; i++) {
        const f = images[i];
        const imgExt = extName(f.name);
        const imgName = "img" + i + "." + imgExt;
        const segName = "seg" + i + ".ts";

        setStatus("Writing photo " + (i + 1) + " of " + images.length + "…", true);
        await ffmpeg.writeFile(imgName, await fetchFile(f));

        setStatus("Rendering photo " + (i + 1) + " of " + images.length + "…", true);
        setProgress(0);
        const ret = await ffmpeg.exec([
          "-loop", "1",
          "-i", imgName,
          "-t", String(perPhoto),
          "-vf", vf,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
          segName,
        ]);
        if (ret !== 0) {
          throw new Error("ffmpeg exited with code " + ret + " while rendering \"" + f.name + "\". See the log below for details.");
        }
        segNames.push(segName);
        try {
          await ffmpeg.deleteFile(imgName);
        } catch (_) {}
      }

      const listContent = segNames.map((n) => "file '" + n + "'").join("\n");
      await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(listContent));

      setStatus("Joining photos…", true);
      setProgress(0);
      let ret = await ffmpeg.exec([
        "-f", "concat", "-safe", "0", "-i", "concat_list.txt",
        "-c", "copy",
        "silent.mp4",
      ]);
      if (ret !== 0) {
        throw new Error("ffmpeg exited with code " + ret + " while joining photos. See the log below for details.");
      }

      let finalName = "silent.mp4";
      if (musicCheck.checked && musicFile) {
        setStatus("Mixing in background music…", true);
        setProgress(0);
        const musicExt = extName(musicFile.name);
        const musicName = "music." + musicExt;
        await ffmpeg.writeFile(musicName, await fetchFile(musicFile));
        ret = await ffmpeg.exec([
          "-i", "silent.mp4",
          "-i", musicName,
          "-map", "0:v:0",
          "-map", "1:a:0",
          "-c:v", "copy",
          "-c:a", "aac",
          "-shortest",
          "-movflags", "+faststart",
          "output.mp4",
        ]);
        if (ret !== 0) {
          throw new Error("ffmpeg exited with code " + ret + " while adding music. See the log below for details.");
        }
        finalName = "output.mp4";
      } else {
        ret = await ffmpeg.exec(["-i", "silent.mp4", "-c", "copy", "-movflags", "+faststart", "output.mp4"]);
        if (ret !== 0) throw new Error("ffmpeg exited with code " + ret + ". See the log below for details.");
        finalName = "output.mp4";
      }

      const data = await ffmpeg.readFile(finalName);
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
        await ffmpeg.deleteFile("silent.mp4");
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
