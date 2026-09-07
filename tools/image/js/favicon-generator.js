(function () {
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
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var thumbGrid = document.getElementById("thumb-grid");
  var htmlSnippetBtn = document.getElementById("html-snippet-btn");
  var snippetDetails = document.getElementById("snippet-details");
  var snippetOutput = document.getElementById("snippet-output");

  var MAX_BYTES = 30 * 1024 * 1024;
  var SIZES = [16, 32, 48, 64, 96, 128, 180, 192, 512];
  var currentFile = null;
  var currentImg = null;
  var generated = [];

  function loadFile(file) {
    showBanner(loadError, "");
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
      preview.style.display = "block";
      controlsCard.style.display = "block";
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      showBanner(loadError, "Couldn't decode this image.");
    };
    img.src = url;
  }

  wireDropZone(dropZone, fileInput, loadFile);

  function renderSize(size) {
    return new Promise(function (resolve) {
      var srcSize = Math.min(currentImg.naturalWidth, currentImg.naturalHeight);
      var sx = (currentImg.naturalWidth - srcSize) / 2;
      var sy = (currentImg.naturalHeight - srcSize) / 2;
      var canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      var ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(currentImg, sx, sy, srcSize, srcSize, 0, 0, size, size);
      canvas.toBlob(function (blob) {
        resolve({ size: size, blob: blob, url: blob ? URL.createObjectURL(blob) : null });
      }, "image/png");
    });
  }

  processBtn.addEventListener("click", function () {
    if (!currentImg) return;
    showBanner(errorBanner, "");
    processBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Generating…';
    thumbGrid.innerHTML = "";
    generated = [];

    Promise.all(SIZES.map(renderSize))
      .then(function (results) {
        processBtn.disabled = false;
        statusLine.textContent = "";
        var failed = results.filter(function (r) {
          return !r.blob;
        });
        if (failed.length === results.length) {
          showBanner(errorBanner, "Generation failed.");
          return;
        }
        generated = results.filter(function (r) {
          return r.blob;
        });
        generated.forEach(function (r) {
          var wrapper = document.createElement("div");
          wrapper.style.textAlign = "center";
          var img = document.createElement("img");
          img.src = r.url;
          img.alt = r.size + "x" + r.size;
          img.style.background = "#fff";
          var label = document.createElement("div");
          label.className = "hint";
          label.style.margin = "4px 0";
          label.textContent = r.size + "×" + r.size + " · " + formatBytes(r.blob.size);
          var link = document.createElement("a");
          link.className = "btn btn-secondary";
          link.style.padding = "4px 10px";
          link.style.fontSize = "12px";
          link.href = r.url;
          link.download = "favicon-" + r.size + "x" + r.size + ".png";
          link.textContent = "Download";
          wrapper.appendChild(img);
          wrapper.appendChild(label);
          wrapper.appendChild(link);
          thumbGrid.appendChild(wrapper);
        });
        snippetOutput.textContent = SIZES.map(function (s) {
          return '<link rel="icon" type="image/png" sizes="' + s + "x" + s + '" href="/favicon-' + s + "x" + s + '.png">';
        }).join("\n");
        snippetDetails.style.display = "block";
        outputCard.classList.add("visible");
      })
      .catch(function (err) {
        processBtn.disabled = false;
        statusLine.textContent = "";
        showBanner(errorBanner, "Something went wrong: " + err.message);
      });
  });

  htmlSnippetBtn.addEventListener("click", function () {
    snippetDetails.open = true;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(snippetOutput.textContent).catch(function () {});
    }
  });
})();
