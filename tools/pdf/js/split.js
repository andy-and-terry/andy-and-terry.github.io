/* Split tool: renders page thumbnails via pdf.js, splits/extracts pages via pdf-lib. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var thumbsCard = document.getElementById("thumbs-card");
  var thumbGrid = document.getElementById("thumb-grid");
  var controlsCard = document.getElementById("controls-card");
  var modeSelect = document.getElementById("mode-select");
  var rangesField = document.getElementById("ranges-field");
  var rangesInput = document.getElementById("ranges-input");
  var outputName = document.getElementById("output-name");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var outputList = document.getElementById("output-list");

  var currentFile = null;
  var currentBytes = null;
  var pageCount = 0;
  var selectedPages = new Set();

  function clearError() {
    errorBanner.innerHTML = "";
  }
  function showError(message) {
    errorBanner.innerHTML = '<div class="banner banner-error">' + message + "</div>";
  }
  function setStatus(text, busy) {
    statusLine.innerHTML = busy
      ? '<span class="spinner"></span><span>' + text + "</span>"
      : text
      ? "<span>" + text + "</span>"
      : "";
  }

  function resetUI() {
    thumbsCard.style.display = "none";
    controlsCard.style.display = "none";
    outputCard.classList.remove("visible");
    outputList.innerHTML = "";
    thumbGrid.innerHTML = "";
    selectedPages.clear();
    clearError();
    setStatus("", false);
  }

  async function handleFile(file) {
    resetUI();
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      showError("Please choose a PDF file.");
      return;
    }
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = PdfCommon.formatSize(file.size);
    fileInfo.style.display = "flex";
    setStatus("Loading pages…", true);

    try {
      currentBytes = await file.arrayBuffer();
      var pdfJsDoc = await PdfCommon.loadPdfJsDoc(currentBytes.slice(0));
      pageCount = pdfJsDoc.numPages;

      for (var i = 1; i <= pageCount; i++) {
        var wrap = document.createElement("div");
        wrap.style.cursor = "pointer";
        wrap.style.border = "2px solid transparent";
        wrap.style.borderRadius = "6px";
        wrap.dataset.page = String(i);

        var canvas = await PdfCommon.renderThumbnail(pdfJsDoc, i, 150);
        canvas.style.width = "100%";
        canvas.style.borderRadius = "4px";
        wrap.appendChild(canvas);

        var label = document.createElement("div");
        label.style.fontSize = "11px";
        label.style.textAlign = "center";
        label.style.color = "var(--text-faint)";
        label.textContent = "Page " + i;
        wrap.appendChild(label);

        wrap.addEventListener("click", function () {
          var pageNum = parseInt(this.dataset.page, 10);
          if (selectedPages.has(pageNum)) {
            selectedPages.delete(pageNum);
            this.style.borderColor = "transparent";
          } else {
            selectedPages.add(pageNum);
            this.style.borderColor = "var(--accent)";
          }
        });

        thumbGrid.appendChild(wrap);
      }

      thumbsCard.style.display = "block";
      controlsCard.style.display = "block";
      setStatus("", false);
    } catch (err) {
      console.error(err);
      showError(PdfCommon.describeLoadError(err));
      setStatus("", false);
    }
  }

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", function () {
    handleFile(fileInput.files[0]);
    fileInput.value = "";
  });
  ["dragenter", "dragover"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  modeSelect.addEventListener("change", function () {
    rangesField.style.display = modeSelect.value === "ranges" ? "block" : "none";
  });

  function triggerDownload(bytes, name) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var url = URL.createObjectURL(blob);
    var li = document.createElement("li");
    var nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = name + " (" + PdfCommon.formatSize(blob.size) + ")";
    var link = document.createElement("a");
    link.className = "btn btn-secondary";
    link.href = url;
    link.download = name;
    link.textContent = "Download";
    li.appendChild(nameSpan);
    li.appendChild(link);
    outputList.appendChild(li);
  }

  processBtn.addEventListener("click", function () {
    if (!currentBytes) return;
    clearError();
    outputCard.classList.remove("visible");
    outputList.innerHTML = "";
    processBtn.disabled = true;
    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    setStatus("Splitting…", true);

    (async function () {
      try {
        var prefix = (outputName.value || "split").trim() || "split";
        var mode = modeSelect.value;

        if (mode === "ranges") {
          var ranges = PdfCommon.parseRanges(rangesInput.value, pageCount);
          for (var i = 0; i < ranges.length; i++) {
            var r = ranges[i];
            var src = await PDFLib.PDFDocument.load(currentBytes.slice(0));
            var out = await PDFLib.PDFDocument.create();
            var indices = [];
            for (var p = r.start; p <= r.end; p++) indices.push(p - 1);
            var copied = await out.copyPages(src, indices);
            copied.forEach(function (pg) { out.addPage(pg); });
            var bytes = await out.save();
            triggerDownload(bytes, prefix + "-" + (i + 1) + "-pages-" + r.start + "-" + r.end + ".pdf");
            progressFill.style.width = Math.round(((i + 1) / ranges.length) * 100) + "%";
          }
        } else if (mode === "selection") {
          if (selectedPages.size === 0) {
            throw new Error("Click at least one page thumbnail to select pages to extract.");
          }
          var sorted = Array.from(selectedPages).sort(function (a, b) { return a - b; });
          var srcDoc = await PDFLib.PDFDocument.load(currentBytes.slice(0));
          var outDoc = await PDFLib.PDFDocument.create();
          var copiedPages = await outDoc.copyPages(srcDoc, sorted.map(function (n) { return n - 1; }));
          copiedPages.forEach(function (pg) { outDoc.addPage(pg); });
          var outBytes = await outDoc.save();
          triggerDownload(outBytes, prefix + "-selected.pdf");
          progressFill.style.width = "100%";
        } else {
          for (var page = 1; page <= pageCount; page++) {
            var s = await PDFLib.PDFDocument.load(currentBytes.slice(0));
            var o = await PDFLib.PDFDocument.create();
            var cp = await o.copyPages(s, [page - 1]);
            cp.forEach(function (pg) { o.addPage(pg); });
            var b = await o.save();
            triggerDownload(b, prefix + "-page-" + page + ".pdf");
            progressFill.style.width = Math.round((page / pageCount) * 100) + "%";
          }
        }

        outputCard.classList.add("visible");
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while splitting this PDF.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
