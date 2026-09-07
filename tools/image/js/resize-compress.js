(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileName = document.getElementById("file-name");
  var fileSize = document.getElementById("file-size");
  var preview = document.getElementById("preview");
  var loadError = document.getElementById("load-error");
  var controlsCard = document.getElementById("controls-card");
  var widthInput = document.getElementById("width-input");
  var heightInput = document.getElementById("height-input");
  var lockAspect = document.getElementById("lock-aspect");
  var formatSelect = document.getElementById("format-select");
  var qualityField = document.getElementById("quality-field");
  var qualityInput = document.getElementById("quality-input");
  var qualityValue = document.getElementById("quality-value");
  var processBtn = document.getElementById("process-btn");
  var resetBtn = document.getElementById("reset-btn");
  var statusLine = document.getElementById("status-line");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var beforePreview = document.getElementById("before-preview");
  var beforeSize = document.getElementById("before-size");
  var afterPreview = document.getElementById("after-preview");
  var afterSize = document.getElementById("after-size");
  var downloadLink = document.getElementById("download-link");

  var MAX_BYTES = 60 * 1024 * 1024;
  var currentFile = null;
  var currentImg = null;
  var naturalW = 0;
  var naturalH = 0;

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function extForFormat(fmt) {
    if (fmt === "image/png") return "png";
    if (fmt === "image/webp") return "webp";
    return "jpg";
  }

  function updateQualityVisibility() {
    qualityField.style.display = formatSelect.value === "image/png" ? "none" : "block";
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

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      currentFile = file;
      currentImg = img;
      naturalW = img.naturalWidth;
      naturalH = img.naturalHeight;

      fileName.textContent = file.name;
      fileSize.textContent = formatBytes(file.size);
      fileInfo.style.display = "flex";
      preview.src = url;
      preview.style.display = "block";

      widthInput.value = naturalW;
      heightInput.value = naturalH;
      controlsCard.style.display = "block";
      statusLine.textContent = "";
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showBanner(
        loadError,
        "Couldn't decode this image. HEIC/HEIF files aren't supported here — try the Convert tool first."
      );
    };
    img.src = url;
  }

  wireDropZone(dropZone, fileInput, loadFile);

  widthInput.addEventListener("input", function () {
    if (!naturalW || !naturalH) return;
    if (lockAspect.checked && widthInput.value) {
      heightInput.value = Math.round((widthInput.value / naturalW) * naturalH);
    }
  });
  heightInput.addEventListener("input", function () {
    if (!naturalW || !naturalH) return;
    if (lockAspect.checked && heightInput.value) {
      widthInput.value = Math.round((heightInput.value / naturalH) * naturalW);
    }
  });

  qualityInput.addEventListener("input", function () {
    qualityValue.textContent = qualityInput.value;
  });
  formatSelect.addEventListener("change", updateQualityVisibility);
  updateQualityVisibility();

  resetBtn.addEventListener("click", function () {
    widthInput.value = naturalW;
    heightInput.value = naturalH;
    qualityInput.value = 80;
    qualityValue.textContent = 80;
    formatSelect.value = "image/jpeg";
    updateQualityVisibility();
  });

  processBtn.addEventListener("click", function () {
    if (!currentImg) return;
    showBanner(errorBanner, "");

    var w = parseInt(widthInput.value, 10);
    var h = parseInt(heightInput.value, 10);
    if (!w || !h || w <= 0 || h <= 0) {
      showBanner(errorBanner, "Enter a valid width and height.");
      return;
    }
    if (w > 10000 || h > 10000) {
      showBanner(errorBanner, "Width and height must be 10000px or less.");
      return;
    }

    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Processing…';

    setTimeout(function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        var format = formatSelect.value;
        if (format === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(currentImg, 0, 0, w, h);

        var quality = format === "image/png" ? undefined : qualityInput.value / 100;
        canvas.toBlob(
          function (blob) {
            processBtn.disabled = false;
            statusLine.textContent = "";
            if (!blob) {
              showBanner(errorBanner, "Encoding failed. Try a different format.");
              return;
            }
            var url = URL.createObjectURL(blob);
            beforePreview.src = preview.src;
            beforeSize.textContent = formatBytes(currentFile.size) + " · " + naturalW + "×" + naturalH;
            afterPreview.src = url;
            afterSize.textContent = formatBytes(blob.size) + " · " + w + "×" + h;
            downloadLink.href = url;
            downloadLink.download = baseName(currentFile.name) + "-resized." + extForFormat(format);
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
