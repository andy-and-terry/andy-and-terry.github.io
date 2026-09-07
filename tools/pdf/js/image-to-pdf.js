/* Image-to-PDF tool: reads JPG/PNG images, lets the user reorder them, embeds each as a page via pdf-lib. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var thumbGrid = document.getElementById("thumb-grid");
  var controlsCard = document.getElementById("controls-card");
  var pageSizeSelect = document.getElementById("page-size-select");
  var outputName = document.getElementById("output-name");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var outputSize = document.getElementById("output-size");
  var downloadLink = document.getElementById("download-link");

  var PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] };

  var entries = []; // { id, file, url }
  var nextId = 1;
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

  function renderThumbs() {
    thumbGrid.innerHTML = "";
    entries.forEach(function (entry, index) {
      var wrap = document.createElement("div");
      wrap.style.position = "relative";
      wrap.draggable = true;
      wrap.dataset.index = String(index);

      var img = document.createElement("img");
      img.src = entry.url;
      img.alt = entry.file.name;
      wrap.appendChild(img);

      var badge = document.createElement("div");
      badge.style.position = "absolute";
      badge.style.top = "4px";
      badge.style.left = "4px";
      badge.style.background = "rgba(0,0,0,0.6)";
      badge.style.color = "#fff";
      badge.style.fontSize = "11px";
      badge.style.padding = "1px 6px";
      badge.style.borderRadius = "4px";
      badge.textContent = String(index + 1);
      wrap.appendChild(badge);

      var remove = document.createElement("button");
      remove.textContent = "×";
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + entry.file.name);
      remove.style.position = "absolute";
      remove.style.top = "2px";
      remove.style.right = "2px";
      remove.style.background = "rgba(0,0,0,0.6)";
      remove.style.color = "#fff";
      remove.style.border = "none";
      remove.style.borderRadius = "50%";
      remove.style.width = "20px";
      remove.style.height = "20px";
      remove.style.cursor = "pointer";
      remove.addEventListener("click", function () {
        URL.revokeObjectURL(entry.url);
        entries.splice(index, 1);
        renderThumbs();
        updateControlsVisibility();
      });
      wrap.appendChild(remove);

      wrap.addEventListener("dragstart", function () {
        dragIndex = index;
        wrap.style.opacity = "0.4";
      });
      wrap.addEventListener("dragend", function () {
        wrap.style.opacity = "";
        dragIndex = null;
      });
      wrap.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      wrap.addEventListener("drop", function (e) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        var moved = entries.splice(dragIndex, 1)[0];
        entries.splice(index, 0, moved);
        renderThumbs();
      });

      thumbGrid.appendChild(wrap);
    });
  }

  function updateControlsVisibility() {
    controlsCard.style.display = entries.length >= 1 ? "block" : "none";
    outputCard.classList.remove("visible");
    clearError();
  }

  function addFiles(fileArray) {
    clearError();
    var rejected = [];
    fileArray.forEach(function (file) {
      var isImage = file.type === "image/png" || file.type === "image/jpeg" || /\.(png|jpe?g)$/i.test(file.name);
      if (!isImage) {
        rejected.push(file.name);
        return;
      }
      entries.push({ id: nextId++, file: file, url: URL.createObjectURL(file) });
    });
    if (rejected.length) {
      showError("Skipped unsupported file" + (rejected.length > 1 ? "s" : "") + " (only JPG/PNG supported): " + rejected.join(", "));
    }
    renderThumbs();
    updateControlsVisibility();
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
    addFiles(Array.prototype.slice.call(fileInput.files));
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
    var files = e.dataTransfer && e.dataTransfer.files ? Array.prototype.slice.call(e.dataTransfer.files) : [];
    if (files.length) addFiles(files);
  });

  processBtn.addEventListener("click", function () {
    if (entries.length < 1) return;
    clearError();
    outputCard.classList.remove("visible");
    processBtn.disabled = true;
    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    setStatus("Building PDF…", true);

    (async function () {
      try {
        var doc = await PDFLib.PDFDocument.create();
        var pageSizeMode = pageSizeSelect.value;

        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          setStatus("Adding " + entry.file.name + " (" + (i + 1) + " of " + entries.length + ")…", true);
          var bytes = await entry.file.arrayBuffer();
          var image;
          try {
            if (entry.file.type === "image/png" || /\.png$/i.test(entry.file.name)) {
              image = await doc.embedPng(bytes);
            } else {
              image = await doc.embedJpg(bytes);
            }
          } catch (embedErr) {
            throw new Error('"' + entry.file.name + '" could not be read as an image. It may be corrupt or an unsupported format.');
          }

          if (pageSizeMode === "fit") {
            var page = doc.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          } else {
            var size = PAGE_SIZES[pageSizeMode];
            var page2 = doc.addPage(size);
            var scale = Math.min(size[0] / image.width, size[1] / image.height);
            var w = image.width * scale;
            var h = image.height * scale;
            page2.drawImage(image, { x: (size[0] - w) / 2, y: (size[1] - h) / 2, width: w, height: h });
          }

          progressFill.style.width = Math.round(((i + 1) / entries.length) * 100) + "%";
        }

        setStatus("Finalizing…", true);
        var outBytes = await doc.save();
        var blob = new Blob([outBytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var name = (outputName.value || "images.pdf").trim() || "images.pdf";
        if (!/\.pdf$/i.test(name)) name += ".pdf";
        downloadLink.href = url;
        downloadLink.download = name;
        outputSize.textContent = PdfCommon.formatSize(blob.size) + " · " + doc.getPageCount() + " pages";
        outputCard.classList.add("visible");
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while building this PDF.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
