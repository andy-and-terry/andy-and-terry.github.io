/* Rotate & reorder tool: thumbnails via pdf.js, page order/rotation/removal tracked client-side, rebuilt via pdf-lib. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var thumbsCard = document.getElementById("thumbs-card");
  var thumbGrid = document.getElementById("thumb-grid");
  var controlsCard = document.getElementById("controls-card");
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
  // pages: [{ originalIndex, rotation }] in current order; rotation is added on top of the page's existing rotation.
  var pages = [];
  var dragIndex = null;

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
    thumbGrid.innerHTML = "";
    pages = [];
    clearError();
    setStatus("", false);
  }

  function renderTiles() {
    thumbGrid.innerHTML = "";
    pages.forEach(function (pageState, index) {
      var tile = document.createElement("div");
      tile.className = "page-tile";
      tile.draggable = true;
      tile.dataset.index = String(index);

      var canvas = pageState.canvas.cloneNode();
      canvas.getContext("2d").drawImage(pageState.canvas, 0, 0);
      canvas.style.transform = "rotate(" + pageState.rotation + "deg)";
      tile.appendChild(canvas);

      var footer = document.createElement("div");
      footer.className = "tile-footer";

      var label = document.createElement("span");
      label.className = "page-label";
      label.textContent = "#" + (index + 1);
      footer.appendChild(label);

      var rotateBtn = document.createElement("button");
      rotateBtn.type = "button";
      rotateBtn.className = "tile-btn";
      rotateBtn.textContent = "⟳ Rotate";
      rotateBtn.addEventListener("click", function () {
        pageState.rotation = (pageState.rotation + 90) % 360;
        renderTiles();
      });
      footer.appendChild(rotateBtn);

      tile.appendChild(footer);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "×";
      removeBtn.setAttribute("aria-label", "Remove page " + (index + 1));
      removeBtn.addEventListener("click", function () {
        pages.splice(index, 1);
        renderTiles();
      });
      tile.appendChild(removeBtn);

      tile.addEventListener("dragstart", function () {
        dragIndex = index;
        tile.classList.add("dragging");
      });
      tile.addEventListener("dragend", function () {
        tile.classList.remove("dragging");
        dragIndex = null;
      });
      tile.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      tile.addEventListener("drop", function (e) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        var moved = pages.splice(dragIndex, 1)[0];
        pages.splice(index, 0, moved);
        renderTiles();
      });

      thumbGrid.appendChild(tile);
    });
  }

  async function handleFile(file) {
    resetUI();
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      showError("Please choose a PDF file.");
      return;
    }
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = PdfCommon.formatSize(file.size);
    fileInfo.style.display = "flex";
    setStatus("Loading pages…", true);

    try {
      currentBytes = await file.arrayBuffer();
      var doc = await PdfCommon.loadPdfJsDoc(currentBytes.slice(0));
      var count = doc.numPages;

      for (var i = 1; i <= count; i++) {
        var canvas = await PdfCommon.renderThumbnail(doc, i, 150);
        pages.push({ originalIndex: i - 1, rotation: 0, canvas: canvas });
      }

      renderTiles();
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

  processBtn.addEventListener("click", function () {
    if (!currentBytes) return;
    if (pages.length === 0) {
      showError("All pages have been removed — there's nothing to save.");
      return;
    }
    clearError();
    outputCard.classList.remove("visible");
    processBtn.disabled = true;
    progressTrack.style.display = "block";
    progressFill.style.width = "20%";
    setStatus("Saving…", true);

    (async function () {
      try {
        var srcDoc = await PDFLib.PDFDocument.load(currentBytes.slice(0));
        var outDoc = await PDFLib.PDFDocument.create();
        var indices = pages.map(function (p) { return p.originalIndex; });
        var copiedPages = await outDoc.copyPages(srcDoc, indices);

        copiedPages.forEach(function (page, i) {
          var extraRotation = pages[i].rotation;
          if (extraRotation) {
            var current = page.getRotation().angle || 0;
            page.setRotation(PDFLib.degrees((current + extraRotation) % 360));
          }
          outDoc.addPage(page);
        });

        progressFill.style.width = "80%";
        var outBytes = await outDoc.save();
        var blob = new Blob([outBytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var name = (outputName.value || "edited.pdf").trim() || "edited.pdf";
        if (!/\.pdf$/i.test(name)) name += ".pdf";
        downloadLink.href = url;
        downloadLink.download = name;
        outputSize.textContent = PdfCommon.formatSize(blob.size) + " · " + outDoc.getPageCount() + " pages";
        outputCard.classList.add("visible");
        progressFill.style.width = "100%";
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while saving this PDF.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
