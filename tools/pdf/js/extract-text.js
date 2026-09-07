/* Extract-text tool: walks every page's text content via pdf.js and joins it into plain text. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var textOutput = document.getElementById("text-output");
  var copyBtn = document.getElementById("copy-btn");
  var downloadLink = document.getElementById("download-link");

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

  async function handleFile(file) {
    outputCard.classList.remove("visible");
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
    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    setStatus("Loading…", true);

    try {
      var bytes = await file.arrayBuffer();
      var doc = await PdfCommon.loadPdfJsDoc(bytes);
      var count = doc.numPages;
      var pagesText = [];
      var anyText = false;

      for (var i = 1; i <= count; i++) {
        setStatus("Extracting text from page " + i + " of " + count + "…", true);
        var page = await doc.getPage(i);
        var content = await page.getTextContent();
        var pageText = content.items.map(function (item) { return item.str; }).join(" ").replace(/\s+/g, " ").trim();
        if (pageText) anyText = true;
        pagesText.push("--- Page " + i + " ---\n" + pageText);
        progressFill.style.width = Math.round((i / count) * 100) + "%";
      }

      var fullText = pagesText.join("\n\n");
      textOutput.value = fullText;

      var blob = new Blob([fullText], { type: "text/plain" });
      var url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = file.name.replace(/\.pdf$/i, "") + ".txt";

      outputCard.classList.add("visible");
      if (!anyText) {
        showError("No selectable text was found. This PDF may be a scanned image without an OCR text layer.");
      }
      setStatus("Done.", false);
    } catch (err) {
      console.error(err);
      showError(PdfCommon.describeLoadError(err));
      setStatus("", false);
    } finally {
      progressTrack.style.display = "none";
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

  copyBtn.addEventListener("click", function () {
    textOutput.select();
    navigator.clipboard && navigator.clipboard.writeText(textOutput.value).catch(function () {
      document.execCommand("copy");
    });
  });
})();
