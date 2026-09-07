(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileName = document.getElementById("file-name");
  var fileSize = document.getElementById("file-size");
  var loadError = document.getElementById("load-error");
  var previewCanvas = document.getElementById("preview-canvas");
  var controlsCard = document.getElementById("controls-card");
  var typeSelect = document.getElementById("type-select");
  var textField = document.getElementById("text-field");
  var logoField = document.getElementById("logo-field");
  var textInput = document.getElementById("text-input");
  var logoInput = document.getElementById("logo-input");
  var positionSelect = document.getElementById("position-select");
  var opacityInput = document.getElementById("opacity-input");
  var opacityValue = document.getElementById("opacity-value");
  var textOnlyFields = document.getElementById("text-only-fields");
  var fontSizeInput = document.getElementById("fontsize-input");
  var fontSizeValue = document.getElementById("fontsize-value");
  var colorInput = document.getElementById("color-input");
  var scaleField = document.getElementById("scale-field");
  var scaleInput = document.getElementById("scale-input");
  var scaleValue = document.getElementById("scale-value");
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
  var logoImg = null;

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function drawBasePreview() {
    var ctx = previewCanvas.getContext("2d");
    previewCanvas.width = currentImg.naturalWidth;
    previewCanvas.height = currentImg.naturalHeight;
    ctx.drawImage(currentImg, 0, 0);
    previewCanvas.style.display = "block";
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
      fileName.textContent = file.name;
      fileSize.textContent = formatBytes(file.size);
      fileInfo.style.display = "flex";
      drawBasePreview();
      controlsCard.style.display = "block";
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showBanner(loadError, "Couldn't decode this image.");
    };
    img.src = url;
  }

  wireDropZone(dropZone, fileInput, loadFile);

  logoInput.addEventListener("change", function () {
    var file = logoInput.files[0];
    if (!file) return;
    if (!isImageFile(file)) {
      showBanner(errorBanner, "Logo must be an image file.");
      return;
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      logoImg = img;
    };
    img.onerror = function () {
      showBanner(errorBanner, "Couldn't decode the logo image.");
    };
    img.src = url;
  });

  typeSelect.addEventListener("change", function () {
    var isText = typeSelect.value === "text";
    textField.style.display = isText ? "block" : "none";
    logoField.style.display = isText ? "none" : "block";
    textOnlyFields.style.display = isText ? "flex" : "none";
    scaleField.style.display = isText ? "none" : "block";
  });
  opacityInput.addEventListener("input", function () {
    opacityValue.textContent = opacityInput.value;
  });
  fontSizeInput.addEventListener("input", function () {
    fontSizeValue.textContent = fontSizeInput.value;
  });
  scaleInput.addEventListener("input", function () {
    scaleValue.textContent = scaleInput.value;
  });

  function positionFor(pos, containerW, containerH, itemW, itemH, margin) {
    switch (pos) {
      case "top-left":
        return { x: margin, y: margin };
      case "top-right":
        return { x: containerW - itemW - margin, y: margin };
      case "bottom-left":
        return { x: margin, y: containerH - itemH - margin };
      case "center":
        return { x: (containerW - itemW) / 2, y: (containerH - itemH) / 2 };
      default:
        return { x: containerW - itemW - margin, y: containerH - itemH - margin };
    }
  }

  processBtn.addEventListener("click", function () {
    if (!currentImg) return;
    var isText = typeSelect.value === "text";
    if (!isText && !logoImg) {
      showBanner(errorBanner, "Choose a logo image first.");
      return;
    }
    if (isText && !textInput.value.trim()) {
      showBanner(errorBanner, "Enter watermark text.");
      return;
    }

    showBanner(errorBanner, "");
    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Applying…';

    setTimeout(function () {
      try {
        var w = currentImg.naturalWidth;
        var h = currentImg.naturalHeight;
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(currentImg, 0, 0);

        var opacity = opacityInput.value / 100;
        var margin = Math.round(Math.min(w, h) * 0.03);

        ctx.globalAlpha = opacity;
        if (isText) {
          var fontSize = parseInt(fontSizeInput.value, 10);
          ctx.font = fontSize + "px sans-serif";
          ctx.fillStyle = colorInput.value;
          ctx.textBaseline = "top";
          var metrics = ctx.measureText(textInput.value);
          var pos = positionFor(positionSelect.value, w, h, metrics.width, fontSize, margin);
          ctx.fillText(textInput.value, pos.x, pos.y);
        } else {
          var scalePct = scaleInput.value / 100;
          var logoW = w * scalePct;
          var logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth);
          var lpos = positionFor(positionSelect.value, w, h, logoW, logoH, margin);
          ctx.drawImage(logoImg, lpos.x, lpos.y, logoW, logoH);
        }
        ctx.globalAlpha = 1;

        canvas.toBlob(function (blob) {
          processBtn.disabled = false;
          statusLine.textContent = "";
          if (!blob) {
            showBanner(errorBanner, "Applying watermark failed.");
            return;
          }
          var url = URL.createObjectURL(blob);
          afterPreview.src = url;
          afterSize.textContent = formatBytes(blob.size) + " · " + w + "×" + h;
          downloadLink.href = url;
          downloadLink.download = baseName(currentFile.name) + "-watermarked.png";
          outputCard.classList.add("visible");
        }, "image/png");
      } catch (err) {
        processBtn.disabled = false;
        statusLine.textContent = "";
        showBanner(errorBanner, "Something went wrong: " + err.message);
      }
    }, 20);
  });
})();
