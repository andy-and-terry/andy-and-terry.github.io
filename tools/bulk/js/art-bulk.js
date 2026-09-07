(function () {
  "use strict";

  var algoSelect = document.getElementById("algo-select");
  var countInput = document.getElementById("count-input");
  var seedModeSelect = document.getElementById("seed-mode-select");
  var startSeedInput = document.getElementById("start-seed-input");
  var generateBtn = document.getElementById("generate-btn");
  var downloadZipBtn = document.getElementById("download-zip-btn");
  var statusLine = document.getElementById("status-line");
  var errorBanner = document.getElementById("error-banner");
  var resultsCard = document.getElementById("results-card");
  var queueSummary = document.getElementById("queue-summary");
  var resultGrid = document.getElementById("result-grid");

  var items = []; // { id, seed, status, blob, error }
  var running = false;

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

  function badge(status) {
    var span = document.createElement("span");
    span.className = "status-badge status-" + status;
    span.textContent = status;
    return span;
  }

  function renderGrid() {
    resultGrid.innerHTML = "";
    items.forEach(function (item) {
      var tile = document.createElement("div");
      tile.className = "result-tile";

      var stage = document.createElement("div");
      stage.className = "thumb-stage";
      if (item.status === "done" && item.blob) {
        var img = document.createElement("img");
        img.src = URL.createObjectURL(item.blob);
        img.alt = "Seed " + item.seed;
        stage.appendChild(img);
      } else if (item.status === "processing") {
        var spinner = document.createElement("div");
        spinner.className = "spinner";
        stage.appendChild(spinner);
      } else if (item.status === "error") {
        var errIcon = document.createElement("span");
        errIcon.textContent = "⚠️";
        errIcon.title = item.error || "Failed";
        stage.appendChild(errIcon);
      }
      tile.appendChild(stage);

      var info = document.createElement("div");
      info.className = "thumb-info";
      var seedLabel = document.createElement("span");
      seedLabel.className = "seed";
      seedLabel.title = item.error || "";
      seedLabel.textContent = "seed " + item.seed;
      info.appendChild(seedLabel);
      if (item.status === "done" && item.blob) {
        var dl = document.createElement("a");
        dl.className = "dl";
        dl.href = URL.createObjectURL(item.blob);
        dl.download = filenameFor(item);
        dl.textContent = "⬇";
        info.appendChild(dl);
      } else {
        info.appendChild(badge(item.status));
      }
      tile.appendChild(info);

      resultGrid.appendChild(tile);
    });
    renderSummary();
  }

  function renderSummary() {
    var done = items.filter(function (i) {
      return i.status === "done";
    }).length;
    var errors = items.filter(function (i) {
      return i.status === "error";
    }).length;
    queueSummary.innerHTML =
      "<span><strong>" + items.length + "</strong> queued</span>" +
      "<span><strong>" + done + "</strong> done</span>" +
      "<span><strong>" + errors + "</strong> failed</span>";
    downloadZipBtn.style.display = done > 0 ? "inline-flex" : "none";
  }

  function filenameFor(item) {
    return algoSelect.value + "-seed" + item.seed + ".png";
  }

  function uniqueFilenames(list) {
    var seen = Object.create(null);
    return list.map(function (item) {
      var name = filenameFor(item);
      if (!seen[name]) {
        seen[name] = 1;
        return name;
      }
      seen[name]++;
      var dot = name.lastIndexOf(".");
      return name.slice(0, dot) + "-" + seen[name] + name.slice(dot);
    });
  }

  function buildSeeds(count, mode, startSeed) {
    var seeds = [];
    for (var i = 0; i < count; i++) {
      seeds.push(mode === "incrementing" ? startSeed + i : ArtCommon.randomSeed32());
    }
    return seeds;
  }

  generateBtn.addEventListener("click", async function () {
    if (running) return;
    running = true;
    generateBtn.disabled = true;
    showError("");

    var algo = ART_ALGOS[algoSelect.value];
    var count = Math.max(1, Math.min(60, parseInt(countInput.value, 10) || 1));
    var mode = seedModeSelect.value;
    var startSeed = parseInt(startSeedInput.value, 10) || 0;
    var seeds = buildSeeds(count, mode, startSeed);

    items = seeds.map(function (seed, i) {
      return { id: i, seed: seed, status: "pending", blob: null, error: "" };
    });
    resultsCard.style.display = "block";
    renderGrid();

    for (var idx = 0; idx < items.length; idx++) {
      var item = items[idx];
      item.status = "processing";
      renderGrid();
      setStatus("Generating " + (idx + 1) + " of " + items.length + " (seed " + item.seed + ")…", true);

      try {
        item.blob = await ArtOpsRunner.run(algo, item.seed);
        item.status = "done";
      } catch (err) {
        item.status = "error";
        item.error = (err && err.message) || String(err);
      }
      renderGrid();
    }

    setStatus("Done.", false);
    running = false;
    generateBtn.disabled = false;
  });

  downloadZipBtn.addEventListener("click", async function () {
    var doneItems = items.filter(function (i) {
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
      a.download = algoSelect.value + "-bulk.zip";
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
})();
