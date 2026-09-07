/* Compress tool: rasterizes each page via pdf.js at a chosen DPI/quality, rebuilds a lighter PDF via pdf-lib. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var controlsCard = document.getElementById("controls-card");
  var dpiInput = document.getElementById("dpi-input");
  var dpiValue = document.getElementById("dpi-value");
  var qualityInput = document.getElementById("quality-input");
  var qualityValue = document.getElementById("quality-value");
  var outputName = document.getElementById("output-name");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var outputSize = document.getElementById("output-size");
  var downloadLink = document.getElementById("download-link");

  var currentFile = null;
  var currentBytes = null;
  var originalSize = 0;

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
  qualityInput.addEventListener("input", function () {
    qualityValue.textContent = qualityInput.value + "%";
  });

  async function handleFile(file) {
    controlsCard.style.display = "none";
    outputCard.classList.remove("visible");
    clearError();
    setStatus("", false);
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      showError("Please choose a PDF file.");
      return;
    }
    currentFile = file;
    originalSize = file.size;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = PdfCommon.formatSize(file.size);
    fileInfo.style.display = "flex";
    setStatus("Checking file…", true);

    try {
      currentBytes = await file.arrayBuffer();
      var doc = await PdfCommon.loadPdfJsDoc(currentBytes.slice(0));
      if (doc.numPages === 0) throw new Error("This PDF has no pages.");
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

  processBtn.addEventListener("click", function () {
    if (!currentBytes) return;
    clearError();
    outputCard.classList.remove("visible");
    processBtn.disabled = true;
    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    setStatus("Rendering pages…", true);

    (async function () {
      try {
        var dpi = parseInt(dpiInput.value, 10);
        var quality = parseInt(qualityInput.value, 10) / 100;
        var pdfJsDoc = await pdfjsLib.getDocument({ data: currentBytes.slice(0) }).promise;
        var pageCount = pdfJsDoc.numPages;
        var outDoc = await PDFLib.PDFDocument.create();

        for (var i = 1; i <= pageCount; i++) {
          setStatus("Compressing page " + i + " of " + pageCount + "…", true);
          var page = await pdfJsDoc.getPage(i);
          var scale = dpi / 72;
          var viewport = page.getViewport({ scale: scale });
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(viewport.width));
          canvas.height = Math.max(1, Math.round(viewport.height));
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          var jpegDataUrl = canvas.toDataURL("image/jpeg", quality);
          var jpegBytes = dataUrlToBytes(jpegDataUrl);
          var jpegImage = await outDoc.embedJpg(jpegBytes);

          var pageWidthPt = (canvas.width / dpi) * 72;
          var pageHeightPt = (canvas.height / dpi) * 72;
          var pdfPage = outDoc.addPage([pageWidthPt, pageHeightPt]);
          pdfPage.drawImage(jpegImage, { x: 0, y: 0, width: pageWidthPt, height: pageHeightPt });

          progressFill.style.width = Math.round((i / pageCount) * 100) + "%";
        }

        setStatus("Finalizing…", true);
        var outBytes = await outDoc.save();
        var blob = new Blob([outBytes], { type: "application/pdf" });

        if (blob.size >= originalSize) {
          showError(
            "The compressed file (" + PdfCommon.formatSize(blob.size) + ") isn't smaller than the original (" +
            PdfCommon.formatSize(originalSize) + "). Try a lower resolution or quality. You can still download it below."
          );
        }

        var url = URL.createObjectURL(blob);
        var name = (outputName.value || "compressed.pdf").trim() || "compressed.pdf";
        if (!/\.pdf$/i.test(name)) name += ".pdf";
        downloadLink.href = url;
        downloadLink.download = name;
        var pct = originalSize ? Math.round((1 - blob.size / originalSize) * 100) : 0;
        outputSize.textContent =
          PdfCommon.formatSize(originalSize) + " → " + PdfCommon.formatSize(blob.size) +
          (pct > 0 ? " (" + pct + "% smaller)" : "");
        outputCard.classList.add("visible");
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while compressing this PDF.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });

  function dataUrlToBytes(dataUrl) {
    var base64 = dataUrl.split(",")[1];
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
})();
