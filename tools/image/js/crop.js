(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileName = document.getElementById("file-name");
  var fileSize = document.getElementById("file-size");
  var loadError = document.getElementById("load-error");
  var cropStage = document.getElementById("crop-stage");
  var preview = document.getElementById("preview");
  var cropBox = document.getElementById("crop-box");
  var cropHandle = document.getElementById("crop-handle");
  var controlsCard = document.getElementById("controls-card");
  var cropDims = document.getElementById("crop-dims");
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
  var box = { x: 0, y: 0, w: 0, h: 0 };

  function baseName(name) {
    var i = name.lastIndexOf(".");
    return i > 0 ? name.slice(0, i) : name;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function displayScale() {
    return preview.clientWidth / currentImg.naturalWidth;
  }

  function renderBox() {
    var s = displayScale();
    cropBox.style.left = box.x * s + "px";
    cropBox.style.top = box.y * s + "px";
    cropBox.style.width = box.w * s + "px";
    cropBox.style.height = box.h * s + "px";
    cropDims.textContent = Math.round(box.w) + " × " + Math.round(box.h) + " px at (" + Math.round(box.x) + ", " + Math.round(box.y) + ")";
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

      preview.src = url;
      cropStage.style.display = "inline-block";

      requestAnimationFrame(function () {
        box = {
          x: img.naturalWidth * 0.1,
          y: img.naturalHeight * 0.1,
          w: img.naturalWidth * 0.8,
          h: img.naturalHeight * 0.8,
        };
        renderBox();
        controlsCard.style.display = "block";
      });
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showBanner(loadError, "Couldn't decode this image.");
    };
    img.src = url;
  }

  wireDropZone(dropZone, fileInput, loadFile);

  window.addEventListener("resize", function () {
    if (currentImg) renderBox();
  });

  var drag = null;

  function pointerPos(e) {
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  cropBox.addEventListener("pointerdown", function (e) {
    if (e.target === cropHandle) return;
    e.preventDefault();
    drag = { type: "move", start: pointerPos(e), boxStart: { x: box.x, y: box.y } };
    cropBox.setPointerCapture(e.pointerId);
  });

  cropHandle.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    e.stopPropagation();
    drag = { type: "resize", start: pointerPos(e), boxStart: { w: box.w, h: box.h } };
    cropHandle.setPointerCapture(e.pointerId);
  });

  document.addEventListener("pointermove", function (e) {
    if (!drag || !currentImg) return;
    var s = displayScale();
    var pos = pointerPos(e);
    var dx = (pos.x - drag.start.x) / s;
    var dy = (pos.y - drag.start.y) / s;

    if (drag.type === "move") {
      box.x = clamp(drag.boxStart.x + dx, 0, currentImg.naturalWidth - box.w);
      box.y = clamp(drag.boxStart.y + dy, 0, currentImg.naturalHeight - box.h);
    } else {
      box.w = clamp(drag.boxStart.w + dx, 20, currentImg.naturalWidth - box.x);
      box.h = clamp(drag.boxStart.h + dy, 20, currentImg.naturalHeight - box.y);
    }
    renderBox();
  });

  document.addEventListener("pointerup", function () {
    drag = null;
  });

  processBtn.addEventListener("click", function () {
    if (!currentImg) return;
    showBanner(errorBanner, "");
    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Cropping…';

    setTimeout(function () {
      try {
        var w = Math.round(box.w);
        var h = Math.round(box.h);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(currentImg, Math.round(box.x), Math.round(box.y), w, h, 0, 0, w, h);

        canvas.toBlob(function (blob) {
          processBtn.disabled = false;
          statusLine.textContent = "";
          if (!blob) {
            showBanner(errorBanner, "Crop failed.");
            return;
          }
          var url = URL.createObjectURL(blob);
          afterPreview.src = url;
          afterSize.textContent = formatBytes(blob.size) + " · " + w + "×" + h;
          downloadLink.href = url;
          downloadLink.download = baseName(currentFile.name) + "-cropped.png";
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
