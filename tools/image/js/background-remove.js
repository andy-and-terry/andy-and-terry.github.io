import { removeBackground } from "../lib/background-removal.mjs";

var dropZone = document.getElementById("drop-zone");
var fileInput = document.getElementById("file-input");
var fileInfo = document.getElementById("file-info");
var fileName = document.getElementById("file-name");
var fileSize = document.getElementById("file-size");
var preview = document.getElementById("preview");
var loadError = document.getElementById("load-error");
var controlsCard = document.getElementById("controls-card");
var processBtn = document.getElementById("process-btn");
var statusLine = document.getElementById("status-line");
var progressTrack = document.getElementById("progress-track");
var progressFill = document.getElementById("progress-fill");
var errorBanner = document.getElementById("error-banner");
var outputCard = document.getElementById("output-card");
var beforePreview = document.getElementById("before-preview");
var afterPreview = document.getElementById("after-preview");
var afterSize = document.getElementById("after-size");
var downloadLink = document.getElementById("download-link");

var MAX_BYTES = 25 * 1024 * 1024;
var currentFile = null;

function baseName(name) {
  var i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function loadFile(file) {
  showBanner(loadError, "");
  showBanner(errorBanner, "");
  outputCard.classList.remove("visible");

  if (!isImageFile(file)) {
    showBanner(loadError, "That doesn't look like an image file.");
    return;
  }
  if (file.size > MAX_BYTES) {
    showBanner(loadError, "File is too large (max " + formatBytes(MAX_BYTES) + ").");
    return;
  }

  currentFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.style.display = "flex";
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  controlsCard.style.display = "block";
}

wireDropZone(dropZone, fileInput, loadFile);

processBtn.addEventListener("click", function () {
  if (!currentFile) return;
  showBanner(errorBanner, "");
  processBtn.disabled = true;
  progressTrack.style.display = "block";
  progressFill.style.width = "0%";
  statusLine.innerHTML = '<span class="spinner"></span> Loading model…';

  removeBackground(currentFile, {
    progress: function (key, current, total) {
      var pct = total ? Math.round((current / total) * 100) : 0;
      progressFill.style.width = pct + "%";
      statusLine.innerHTML = '<span class="spinner"></span> ' + (key || "Processing") + " (" + pct + "%)";
    },
  })
    .then(function (blob) {
      processBtn.disabled = false;
      statusLine.textContent = "Done.";
      progressTrack.style.display = "none";
      var url = URL.createObjectURL(blob);
      beforePreview.src = preview.src;
      afterPreview.src = url;
      afterSize.textContent = formatBytes(blob.size);
      downloadLink.href = url;
      downloadLink.download = baseName(currentFile.name) + "-nobg.png";
      outputCard.classList.add("visible");
    })
    .catch(function (err) {
      processBtn.disabled = false;
      progressTrack.style.display = "none";
      statusLine.textContent = "";
      showBanner(
        errorBanner,
        "Background removal failed: " + (err && err.message ? err.message : "unknown error") +
          ". This can happen on very large images or without a network connection to fetch the model."
      );
    });
});
