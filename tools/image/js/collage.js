(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var loadError = document.getElementById("load-error");
  var fileListEl = document.getElementById("file-list");
  var controlsCard = document.getElementById("controls-card");
  var colsInput = document.getElementById("cols-input");
  var gapInput = document.getElementById("gap-input");
  var bgInput = document.getElementById("bg-input");
  var processBtn = document.getElementById("process-btn");
  var statusLine = document.getElementById("status-line");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var afterPreview = document.getElementById("after-preview");
  var afterSize = document.getElementById("after-size");
  var downloadLink = document.getElementById("download-link");

  var MAX_BYTES = 30 * 1024 * 1024;
  var MAX_FILES = 30;
  var items = [];

  function renderList() {
    fileListEl.innerHTML = "";
    items.forEach(function (item, idx) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = item.file.name + " — " + formatBytes(item.file.size);
      var btn = document.createElement("button");
      btn.className = "remove";
      btn.type = "button";
      btn.textContent = "×";
      btn.addEventListener("click", function () {
        items.splice(idx, 1);
        renderList();
      });
      li.appendChild(name);
      li.appendChild(btn);
      fileListEl.appendChild(li);
    });
    controlsCard.style.display = items.length ? "block" : "none";
    outputCard.classList.remove("visible");
  }

  function addFiles(fileList) {
    showBanner(loadError, "");
    var files = Array.prototype.slice.call(fileList);
    files.forEach(function (file) {
      if (!isImageFile(file)) {
        showBanner(loadError, "Skipped " + file.name + " (not an image).");
        return;
      }
      if (file.size > MAX_BYTES) {
        showBanner(loadError, "Skipped " + file.name + " (too large).");
        return;
      }
      if (items.length >= MAX_FILES) {
        showBanner(loadError, "Only up to " + MAX_FILES + " images are supported.");
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        items.push({ file: file, img: img });
        renderList();
      };
      img.onerror = function () {
        showBanner(loadError, "Couldn't decode " + file.name + ".");
      };
      img.src = url;
    });
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
    addFiles(fileInput.files);
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
    addFiles(e.dataTransfer.files);
  });

  processBtn.addEventListener("click", function () {
    if (!items.length) return;
    showBanner(errorBanner, "");

    var cols = Math.max(1, Math.min(10, parseInt(colsInput.value, 10) || 1));
    var gap = Math.max(0, parseInt(gapInput.value, 10) || 0);
    var rows = Math.ceil(items.length / cols);

    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Building collage…';

    setTimeout(function () {
      try {
        var cellW = 500;
        var cellH = 500;
        var canvas = document.createElement("canvas");
        canvas.width = cols * cellW + (cols - 1) * gap;
        canvas.height = rows * cellH + (rows - 1) * gap;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = bgInput.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        items.forEach(function (item, idx) {
          var col = idx % cols;
          var row = Math.floor(idx / cols);
          var x = col * (cellW + gap);
          var y = row * (cellH + gap);
          var img = item.img;
          var scale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
          var dw = img.naturalWidth * scale;
          var dh = img.naturalHeight * scale;
          var dx = x + (cellW - dw) / 2;
          var dy = y + (cellH - dh) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cellW, cellH);
          ctx.clip();
          ctx.drawImage(img, dx, dy, dw, dh);
          ctx.restore();
        });

        canvas.toBlob(function (blob) {
          processBtn.disabled = false;
          statusLine.textContent = "";
          if (!blob) {
            showBanner(errorBanner, "Building collage failed.");
            return;
          }
          var url = URL.createObjectURL(blob);
          afterPreview.src = url;
          afterSize.textContent = formatBytes(blob.size) + " · " + canvas.width + "×" + canvas.height;
          downloadLink.href = url;
          downloadLink.download = "collage.png";
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
