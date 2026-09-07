(function () {
  "use strict";

  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var queueList = document.getElementById("queue-list");
  var opCard = document.getElementById("op-card");
  var opSelect = document.getElementById("op-select");
  var processCard = document.getElementById("process-card");
  var queueSummary = document.getElementById("queue-summary");
  var startBtn = document.getElementById("start-btn");
  var downloadZipBtn = document.getElementById("download-zip-btn");
  var statusLine = document.getElementById("status-line");
  var errorBanner = document.getElementById("error-banner");

  var queue = []; // { id, file, status, progress, statusText, error, blob, filename }
  var nextId = 1;
  var running = false;

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }

  function showError(msg) {
    errorBanner.innerHTML = "";
    if (!msg) return;
    var div = document.createElement("div");
    div.className = "banner banner-error";
    div.textContent = msg;
    errorBanner.appendChild(div);
  }

  function setStatus(text, spinning) {
    statusLine.innerHTML = "";
    if (spinning) {
      var s = document.createElement("div");
      s.className = "spinner";
      statusLine.appendChild(s);
    }
    var t = document.createElement("span");
    t.textContent = text || "";
    statusLine.appendChild(t);
  }

  function addFiles(list) {
    var arr = Array.from(list || []).filter(function (f) {
      return f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi|m4v|flv|wmv)$/i.test(f.name);
    });
    if (arr.length === 0 && list && list.length) {
      showError("Those don't look like video files.");
      return;
    }
    showError("");
    arr.forEach(function (f) {
      queue.push({ id: nextId++, file: f, status: "pending", progress: 0, statusText: "", error: "" });
    });
    renderQueue();
  }

  function removeItem(id) {
    queue = queue.filter(function (i) {
      return i.id !== id;
    });
    renderQueue();
  }

  function badge(status) {
    var span = document.createElement("span");
    span.className = "status-badge status-" + status;
    span.textContent = status;
    return span;
  }

  function renderQueue() {
    queueList.innerHTML = "";
    queue.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "queue-item";

      var main = document.createElement("div");
      main.className = "queue-main";
      var name = document.createElement("div");
      name.className = "queue-name";
      name.textContent = item.file.name;
      var meta = document.createElement("div");
      meta.className = "queue-meta";
      meta.textContent = fmtBytes(item.file.size) + (item.statusText ? " — " + item.statusText : "");
      if (item.status === "error" && item.error) meta.textContent = item.error;
      main.append(name, meta);

      if (item.status === "processing") {
        var track = document.createElement("div");
        track.className = "progress-track";
        var fill = document.createElement("div");
        fill.className = "progress-fill";
        fill.style.width = Math.round((item.progress || 0) * 100) + "%";
        track.appendChild(fill);
        main.appendChild(track);
      }

      var actions = document.createElement("div");
      actions.className = "queue-actions";
      actions.appendChild(badge(item.status));

      if (item.status === "done") {
        var dl = document.createElement("a");
        dl.className = "btn btn-secondary";
        dl.textContent = "Download";
        dl.href = URL.createObjectURL(item.blob);
        dl.download = item.filename;
        actions.appendChild(dl);
      } else if (item.status === "pending") {
        var rm = document.createElement("button");
        rm.className = "remove";
        rm.title = "Remove";
        rm.textContent = "✕";
        rm.addEventListener("click", function () {
          removeItem(item.id);
        });
        actions.appendChild(rm);
      }

      li.append(main, actions);
      queueList.appendChild(li);
    });

    opCard.style.display = queue.length > 0 ? "block" : "none";
    processCard.style.display = queue.length > 0 ? "block" : "none";
    renderSummary();
  }

  function renderSummary() {
    var done = queue.filter(function (i) {
      return i.status === "done";
    }).length;
    var errors = queue.filter(function (i) {
      return i.status === "error";
    }).length;
    queueSummary.innerHTML =
      "<span><strong>" + queue.length + "</strong> queued</span>" +
      "<span><strong>" + done + "</strong> done</span>" +
      "<span><strong>" + errors + "</strong> failed</span>";
    downloadZipBtn.style.display = done > 0 ? "inline-flex" : "none";
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

  function updateOpPanels() {
    var op = opSelect.value;
    document.querySelectorAll(".op-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-op") === op);
    });
  }
  opSelect.addEventListener("change", updateOpPanels);
  updateOpPanels();

  function bindPill(rangeId, formatter) {
    var range = document.getElementById(rangeId);
    var pill = document.getElementById(rangeId + "-pill");
    if (!range || !pill) return;
    function update() {
      pill.textContent = formatter(range.value);
    }
    range.addEventListener("input", update);
    update();
  }
  bindPill("crf-range", function (v) {
    return "CRF " + v;
  });
  bindPill("speed-range", function (v) {
    return parseFloat(v).toFixed(2) + "x";
  });
  bindPill("brightness-range", function (v) {
    return v;
  });
  bindPill("contrast-range", function (v) {
    return parseFloat(v).toFixed(2);
  });
  bindPill("saturation-range", function (v) {
    return parseFloat(v).toFixed(2);
  });
  bindPill("gamma-range", function (v) {
    return parseFloat(v).toFixed(2);
  });

  function readOptions() {
    return {
      trimStart: parseFloat(document.getElementById("bulk-trim-start").value) || 0,
      trimDuration: parseFloat(document.getElementById("bulk-trim-duration").value) || 1,
    };
  }

  function uniqueFilenames(items) {
    var seen = Object.create(null);
    return items.map(function (item) {
      var name = item.filename;
      if (!seen[name]) {
        seen[name] = 1;
        return name;
      }
      seen[name]++;
      var dot = name.lastIndexOf(".");
      var base = dot > 0 ? name.slice(0, dot) : name;
      var ext = dot > 0 ? name.slice(dot) : "";
      return base + "-" + seen[name] + ext;
    });
  }

  startBtn.addEventListener("click", async function () {
    if (running || queue.length === 0) return;
    running = true;
    startBtn.disabled = true;
    showError("");

    var op = VIDEO_OPS[opSelect.value];
    var opts = readOptions();
    var pending = queue.filter(function (i) {
      return i.status === "pending" || i.status === "error";
    });

    for (var idx = 0; idx < pending.length; idx++) {
      var item = pending[idx];
      item.status = "processing";
      item.progress = 0;
      item.statusText = "Starting…";
      item.error = "";
      renderQueue();
      setStatus("Processing " + (idx + 1) + " of " + pending.length + ": " + item.file.name, true);

      try {
        var result = await VideoOpsRunner.run(op, item.file, opts, function (frac, text) {
          if (frac != null) item.progress = frac;
          if (text) item.statusText = text;
          renderQueue();
        });
        item.status = "done";
        item.blob = result.blob;
        item.filename = result.filename;
        item.progress = 1;
      } catch (err) {
        item.status = "error";
        item.error = (err && err.message) || String(err);
      }
      renderQueue();
    }

    setStatus("Done.", false);
    running = false;
    startBtn.disabled = false;
  });

  downloadZipBtn.addEventListener("click", async function () {
    var doneItems = queue.filter(function (i) {
      return i.status === "done";
    });
    if (doneItems.length === 0) return;
    downloadZipBtn.disabled = true;
    setStatus("Building ZIP…", true);
    try {
      var names = uniqueFilenames(doneItems);
      var zip = new JSZip();
      doneItems.forEach(function (item, i) {
        zip.file(names[i], item.blob);
      });
      var zipBlob = await zip.generateAsync({ type: "blob" });
      var url = URL.createObjectURL(zipBlob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "video-bulk-output.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 10000);
      setStatus("Done.", false);
    } catch (err) {
      showError((err && err.message) || String(err));
      setStatus("Failed.", false);
    } finally {
      downloadZipBtn.disabled = false;
    }
  });

  renderQueue();
})();
