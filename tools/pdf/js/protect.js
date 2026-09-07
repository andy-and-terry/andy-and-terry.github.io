/* Protect tool: add/remove PDF password protection using the @cantoo/pdf-lib fork, which supports encryption.
   Both directions copy pages into a fresh PDFDocument before saving, since re-saving a
   loaded-and-decrypted document directly can leave stale encryption metadata behind. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var controlsCard = document.getElementById("controls-card");
  var modeSelect = document.getElementById("mode-select");
  var currentPasswordField = document.getElementById("current-password-field");
  var currentPasswordInput = document.getElementById("current-password");
  var newPasswordField = document.getElementById("new-password-field");
  var newPasswordInput = document.getElementById("new-password");
  var outputName = document.getElementById("output-name");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var outputSize = document.getElementById("output-size");
  var downloadLink = document.getElementById("download-link");

  var currentBytes = null;
  var isEncrypted = false;

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

  function updateFieldVisibility() {
    var mode = modeSelect.value;
    newPasswordField.style.display = mode === "add" ? "block" : "none";
    currentPasswordField.style.display = mode === "remove" || isEncrypted ? "block" : "none";
  }

  modeSelect.addEventListener("change", updateFieldVisibility);

  async function handleFile(file) {
    controlsCard.style.display = "none";
    outputCard.classList.remove("visible");
    clearError();
    setStatus("", false);
    currentBytes = null;
    isEncrypted = false;
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      showError("Please choose a PDF file.");
      return;
    }
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = PdfCommon.formatSize(file.size);
    fileInfo.style.display = "flex";
    setStatus("Checking file…", true);

    try {
      currentBytes = await file.arrayBuffer();
      var probe = await PDFLib.PDFDocument.load(currentBytes.slice(0), { ignoreEncryption: true });
      isEncrypted = !!probe.isEncrypted;
      if (isEncrypted) modeSelect.value = "remove";
      controlsCard.style.display = "block";
      updateFieldVisibility();
      setStatus("", false);
    } catch (err) {
      console.error(err);
      showError("Couldn't read this PDF: " + (err && err.message ? err.message : "it may be corrupt."));
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
    progressFill.style.width = "30%";
    setStatus("Processing…", true);

    (async function () {
      try {
        var mode = modeSelect.value;
        var loadOpts = {};
        if (isEncrypted || mode === "remove") {
          var pw = currentPasswordInput.value;
          if (!pw) throw new Error("Enter the file's current password to unlock it.");
          loadOpts.password = pw;
        }

        var srcDoc;
        try {
          srcDoc = await PDFLib.PDFDocument.load(currentBytes.slice(0), loadOpts);
        } catch (err) {
          throw new Error("Incorrect password, or this file couldn't be unlocked.");
        }

        progressFill.style.width = "55%";

        // Rebuild into a fresh document so no stale encryption metadata survives either way.
        var outDoc = await PDFLib.PDFDocument.create();
        var copiedPages = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(function (page) {
          outDoc.addPage(page);
        });

        progressFill.style.width = "75%";
        var outBytes;
        if (mode === "add") {
          var newPw = newPasswordInput.value;
          if (!newPw) throw new Error("Enter a new password to protect this file with.");
          outDoc.encrypt({ userPassword: newPw, ownerPassword: newPw });
          outBytes = await outDoc.save();
        } else {
          outBytes = await outDoc.save();
        }

        var blob = new Blob([outBytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var defaultName = mode === "add" ? "protected.pdf" : "unlocked.pdf";
        var name = (outputName.value || defaultName).trim() || defaultName;
        if (!/\.pdf$/i.test(name)) name += ".pdf";
        downloadLink.href = url;
        downloadLink.download = name;
        outputSize.textContent = PdfCommon.formatSize(blob.size);
        outputCard.classList.add("visible");
        progressFill.style.width = "100%";
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
