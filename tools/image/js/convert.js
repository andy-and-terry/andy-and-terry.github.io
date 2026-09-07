(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileName = document.getElementById("file-name");
  var fileSize = document.getElementById("file-size");
  var preview = document.getElementById("preview");
  var loadError = document.getElementById("load-error");
  var loadStatus = document.getElementById("load-status");
  var controlsCard = document.getElementById("controls-card");
  var formatSelect = document.getElementById("format-select");
  var qualityField = document.getElementById("quality-field");
  var qualityInput = document.getElementById("quality-input");
  var qualityValue = document.getElementById("quality-value");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var afterPreview = document.getElementById("after-preview");
  var afterSize = document.getElementById("after-size");
  var downloadLink = document.getElementById("download-link");

  var MAX_BYTES = 60 * 1024 * 1024;
  var currentFile = null;
  var currentImg = null;

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }
  function extForFormat(fmt) {
    if (fmt === "image/png") return "png";
    if (fmt === "image/webp") return "webp";
    return "jpg";
  }
  function isHeic(file) {
    return /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
  }
  function updateQualityVisibility() {
    qualityField.style.display = formatSelect.value === "image/png" ? "none" : "block";
  }
  formatSelect.addEventListener("change", updateQualityVisibility);
  qualityInput.addEventListener("input", function () {
    qualityValue.textContent = qualityInput.value;
  });
  updateQualityVisibility();

  function displayImageBlob(file, blob) {
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      currentImg = img;
      preview.src = url;
      preview.style.display = "block";
      controlsCard.style.display = "block";
      loadStatus.textContent = "";
    };
    img.onerror = function () {
      loadStatus.textContent = "";
      showBanner(loadError, "Couldn't decode the converted image.");
    };
    img.src = url;
  }

  function loadFile(file) {
    showBanner(loadError, "");
    showBanner(errorBanner, "");
    outputCard.classList.remove("visible");
    controlsCard.style.display = "none";
    preview.style.display = "none";
    currentImg = null;

    if (file.size > MAX_BYTES) {
      showBanner(loadError, "File is too large (max " + formatBytes(MAX_BYTES) + ").");
      return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.style.display = "flex";

    if (isHeic(file)) {
      if (typeof heic2any === "undefined") {
        showBanner(loadError, "HEIC decoder failed to load.");
        return;
      }
      loadStatus.innerHTML = '<span class="spinner"></span> Decoding HEIC…';
      heic2any({ blob: file, toType: "image/png" })
        .then(function (blob) {
          displayImageBlob(file, Array.isArray(blob) ? blob[0] : blob);
        })
        .catch(function (err) {
          loadStatus.textContent = "";
          showBanner(loadError, "Couldn't decode this HEIC file: " + err.message);
        });
      return;
    }

    if (!isImageFile(file)) {
      showBanner(loadError, "Unsupported file type.");
      return;
    }
    displayImageBlob(file, file);
  }

  wireDropZone(dropZone, fileInput, loadFile);

  processBtn.addEventListener("click", function () {
    if (!currentImg) return;
    showBanner(errorBanner, "");
    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Converting…';

    setTimeout(function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = currentImg.naturalWidth;
        canvas.height = currentImg.naturalHeight;
        var ctx = canvas.getContext("2d");
        var format = formatSelect.value;
        if (format === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(currentImg, 0, 0);
        var quality = format === "image/png" ? undefined : qualityInput.value / 100;
        canvas.toBlob(
          function (blob) {
            processBtn.disabled = false;
            statusLine.textContent = "";
            if (!blob) {
              showBanner(errorBanner, "Conversion failed. Try a different format.");
              return;
            }
            var url = URL.createObjectURL(blob);
            afterPreview.src = url;
            afterSize.textContent = formatBytes(blob.size);
            downloadLink.href = url;
            downloadLink.download = baseName(currentFile.name) + "." + extForFormat(format);
            outputCard.classList.add("visible");
          },
          format,
          quality
        );
      } catch (err) {
        processBtn.disabled = false;
        statusLine.textContent = "";
        showBanner(errorBanner, "Something went wrong: " + err.message);
      }
    }, 20);
  });
})();
