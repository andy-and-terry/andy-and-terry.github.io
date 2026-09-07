/* Shared helpers used across image tool pages. */

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return bytes + " B";
  var units = ["KB", "MB", "GB"];
  var v = bytes;
  for (var i = 0; i < units.length; i++) {
    v /= 1024;
    if (v < 1024 || i === units.length - 1) return v.toFixed(1) + " " + units[i];
  }
  return v.toFixed(1) + " GB";
}

/* Wires a drop-zone + file input pair. onFile receives a single File. */
function wireDropZone(dropZone, fileInput, onFile, accept) {
  function handleFiles(files) {
    if (!files || !files.length) return;
    var file = files[0];
    if (accept && !accept(file)) return;
    onFile(file);
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
    handleFiles(fileInput.files);
  });
  ["dragenter", "dragover"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    handleFiles(e.dataTransfer.files);
  });
}

function showBanner(container, message, type) {
  type = type || "error";
  container.innerHTML = message
    ? '<div class="banner banner-' + type + '">' + message + "</div>"
    : "";
}

function isImageFile(file) {
  return file && (file.type.indexOf("image/") === 0 || /\.(heic|heif)$/i.test(file.name));
}
