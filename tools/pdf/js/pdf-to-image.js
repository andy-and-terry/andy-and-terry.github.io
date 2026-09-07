/* PDF-to-image tool: renders chosen pages via pdf.js canvas at a chosen DPI, exports as PNG/JPG. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var controlsCard = document.getElementById("controls-card");
  var formatSelect = document.getElementById("format-select");
  var dpiInput = document.getElementById("dpi-input");
  var dpiValue = document.getElementById("dpi-value");
  var rangesInput = document.getElementById("ranges-input");
  var outputName = document.getElementById("output-name");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var outputGrid = document.getElementById("output-grid");
  var outputList = document.getElementById("output-list");

  var currentBytes = null;
  var pageCount = 0;

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

  dpiInput.addEventListener("input", function () {
    dpiValue.textContent = dpiInput.value + " DPI";
  });

  async function handleFile(file) {
    controlsCard.style.display = "none";
    outputCard.classList.remove("visible");
    outputGrid.innerHTML = "";
    outputList.innerHTML = "";
    clearError();
    setStatus("", false);
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      showError("Please choose a PDF file.");
      return;
    }
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = PdfCommon.formatSize(file.size);
    fileInfo.style.display = "flex";
    setStatus("Loading…", true);

    try {
      currentBytes = await file.arrayBuffer();
      var doc = await PdfCommon.loadPdfJsDoc(currentBytes.slice(0));
      pageCount = doc.numPages;
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

  function pagesFromRanges(input, count) {
    if (!input.trim()) {
      var all = [];
      for (var i = 1; i <= count; i++) all.push(i);
      return all;
    }
    var ranges = PdfCommon.parseRanges(input, count);
    var set = new Set();
    ranges.forEach(function (r) {
      for (var p = r.start; p <= r.end; p++) set.add(p);
    });
    return Array.from(set).sort(function (a, b) { return a - b; });
  }

  processBtn.addEventListener("click", function () {
    if (!currentBytes) return;
    clearError();
    outputCard.classList.remove("visible");
    outputGrid.innerHTML = "";
    outputList.innerHTML = "";
    processBtn.disabled = true;
    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    setStatus("Rendering pages…", true);

    (async function () {
      try {
        var pages = pagesFromRanges(rangesInput.value, pageCount);
        var format = formatSelect.value;
        var ext = format === "image/png" ? "png" : "jpg";
        var dpi = parseInt(dpiInput.value, 10);
        var prefix = (outputName.value || "page").trim() || "page";
        var doc = await pdfjsLib.getDocument({ data: currentBytes.slice(0) }).promise;

        for (var i = 0; i < pages.length; i++) {
          var pageNum = pages[i];
          setStatus("Rendering page " + pageNum + " (" + (i + 1) + " of " + pages.length + ")…", true);
          var page = await doc.getPage(pageNum);
          var scale = dpi / 72;
          var viewport = page.getViewport({ scale: scale });
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          var ctx = canvas.getContext("2d");
          if (format === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          var dataUrl = canvas.toDataURL(format, format === "image/jpeg" ? 0.9 : undefined);
          var blob = await (await fetch(dataUrl)).blob();
          var url = URL.createObjectURL(blob);
          var name = prefix + "-" + pageNum + "." + ext;

          var thumb = document.createElement("img");
          thumb.src = dataUrl;
          outputGrid.appendChild(thumb);

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

          progressFill.style.width = Math.round(((i + 1) / pages.length) * 100) + "%";
        }

        outputCard.classList.add("visible");
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while exporting pages.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
