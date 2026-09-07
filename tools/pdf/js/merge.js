/* Merge tool: loads multiple PDFs with pdf-lib, lets the user reorder them, then concatenates pages. */
(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileList = document.getElementById("file-list");
  var controlsCard = document.getElementById("controls-card");
  var outputCard = document.getElementById("output-card");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var progressTrack = document.getElementById("progress-track");
  var progressFill = document.getElementById("progress-fill");
  var errorBanner = document.getElementById("error-banner");
  var outputName = document.getElementById("output-name");
  var outputSize = document.getElementById("output-size");
  var downloadLink = document.getElementById("download-link");

  var entries = []; // { id, file, name }
  var nextId = 1;
  var dragIndex = null;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

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

  function renderList() {
    fileList.innerHTML = "";
    entries.forEach(function (entry, index) {
      var li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = String(index);

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = (index + 1) + ". " + entry.name + " (" + formatSize(entry.file.size) + ")";

      var remove = document.createElement("button");
      remove.className = "remove";
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + entry.name);
      remove.textContent = "×";
      remove.addEventListener("click", function () {
        entries.splice(index, 1);
        renderList();
        updateControlsVisibility();
      });

      li.appendChild(name);
      li.appendChild(remove);
      fileList.appendChild(li);

      li.addEventListener("dragstart", function () {
        dragIndex = index;
        li.style.opacity = "0.5";
      });
      li.addEventListener("dragend", function () {
        li.style.opacity = "";
        dragIndex = null;
      });
      li.addEventListener("dragover", function (e) {
        e.preventDefault();
      });
      li.addEventListener("drop", function (e) {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        var moved = entries.splice(dragIndex, 1)[0];
        entries.splice(index, 0, moved);
        renderList();
      });
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
      var isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isPdf) {
        rejected.push(file.name);
        return;
      }
      entries.push({ id: nextId++, file: file, name: file.name });
    });
    if (rejected.length) {
      showError("Skipped non-PDF file" + (rejected.length > 1 ? "s" : "") + ": " + rejected.join(", "));
    }
    renderList();
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
    setStatus("Reading files…", true);

    (async function () {
      try {
        var merged = await PDFLib.PDFDocument.create();
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          setStatus("Merging " + entry.name + " (" + (i + 1) + " of " + entries.length + ")…", true);
          var bytes = await entry.file.arrayBuffer();
          var srcDoc;
          try {
            srcDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
          } catch (loadErr) {
            throw new Error(
              '"' + entry.name + '" could not be read. It may be corrupt or password-protected. ' +
              "Remove its password first using the Protect tool, then try again."
            );
          }
          var pageIndices = srcDoc.getPageIndices();
          var copiedPages = await merged.copyPages(srcDoc, pageIndices);
          copiedPages.forEach(function (page) {
            merged.addPage(page);
          });
          progressFill.style.width = Math.round(((i + 1) / entries.length) * 100) + "%";
        }

        if (merged.getPageCount() === 0) {
          throw new Error("The merged document has no pages.");
        }

        setStatus("Finalizing…", true);
        var outBytes = await merged.save();
        var blob = new Blob([outBytes], { type: "application/pdf" });
        var url = URL.createObjectURL(blob);
        var name = (outputName.value || "merged.pdf").trim() || "merged.pdf";
        if (!/\.pdf$/i.test(name)) name += ".pdf";

        downloadLink.href = url;
        downloadLink.download = name;
        outputSize.textContent = formatSize(blob.size) + " · " + merged.getPageCount() + " pages";
        outputCard.classList.add("visible");
        setStatus("Done.", false);
      } catch (err) {
        console.error(err);
        showError(err && err.message ? err.message : "Something went wrong while merging these PDFs.");
        setStatus("", false);
      } finally {
        processBtn.disabled = false;
        progressTrack.style.display = "none";
      }
    })();
  });
})();
