(function () {
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileName = document.getElementById("file-name");
  var fileSize = document.getElementById("file-size");
  var preview = document.getElementById("preview");
  var loadError = document.getElementById("load-error");
  var loadStatus = document.getElementById("load-status");
  var exifCard = document.getElementById("exif-card");
  var exifEmpty = document.getElementById("exif-empty");
  var exifTable = document.getElementById("exif-table");
  var gpsLink = document.getElementById("gps-link");
  var stripCard = document.getElementById("strip-card");
  var stripBtn = document.getElementById("strip-btn");
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

  function renderTable(tags) {
    exifTable.innerHTML = "";
    var keys = Object.keys(tags || {});
    if (!keys.length) {
      exifEmpty.style.display = "block";
      return;
    }
    exifEmpty.style.display = "none";
    keys.sort().forEach(function (key) {
      var val = tags[key];
      if (val && typeof val === "object" && !(val instanceof Date)) {
        try {
          val = JSON.stringify(val);
        } catch (e) {
          val = String(val);
        }
      }
      var tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border)";
      var tdKey = document.createElement("td");
      tdKey.style.padding = "6px 8px";
      tdKey.style.color = "var(--text-dim)";
      tdKey.style.whiteSpace = "nowrap";
      tdKey.textContent = key;
      var tdVal = document.createElement("td");
      tdVal.style.padding = "6px 8px";
      tdVal.style.wordBreak = "break-word";
      tdVal.textContent = String(val);
      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      exifTable.appendChild(tr);
    });
  }

  function loadFile(file) {
    showBanner(loadError, "");
    showBanner(errorBanner, "");
    outputCard.classList.remove("visible");
    exifCard.style.display = "none";
    stripCard.style.display = "none";
    gpsLink.style.display = "none";

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

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      currentImg = img;
      preview.src = url;
      preview.style.display = "block";
      stripCard.style.display = "block";
    };
    img.onerror = function () {
      showBanner(loadError, "Couldn't render a preview of this file, but metadata may still be readable.");
      stripCard.style.display = "block";
    };
    img.src = url;

    if (typeof exifr === "undefined") {
      showBanner(loadError, "EXIF library failed to load.");
      return;
    }
    loadStatus.innerHTML = '<span class="spinner"></span> Reading metadata…';
    exifr
      .parse(file, { gps: true, tiff: true, exif: true, ifd0: true, ifd1: true, interop: true, xmp: true, icc: false })
      .then(function (tags) {
        loadStatus.textContent = "";
        exifCard.style.display = "block";
        renderTable(tags);
        if (tags && tags.latitude != null && tags.longitude != null) {
          gpsLink.style.display = "block";
          gpsLink.innerHTML =
            'GPS: ' +
            tags.latitude.toFixed(6) +
            ", " +
            tags.longitude.toFixed(6) +
            ' — <a href="https://www.openstreetmap.org/?mlat=' +
            tags.latitude +
            "&mlon=" +
            tags.longitude +
            '" target="_blank" rel="noopener">view on map</a>';
        }
      })
      .catch(function (err) {
        loadStatus.textContent = "";
        exifCard.style.display = "block";
        renderTable({});
        showBanner(loadError, "Couldn't parse metadata: " + err.message);
      });
  }

  wireDropZone(dropZone, fileInput, loadFile);

  stripBtn.addEventListener("click", function () {
    if (!currentImg) {
      showBanner(errorBanner, "No decodable image to re-save.");
      return;
    }
    showBanner(errorBanner, "");
    stripBtn.disabled = true;
    statusLine.innerHTML = '<span class="spinner"></span> Stripping metadata…';

    setTimeout(function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = currentImg.naturalWidth;
        canvas.height = currentImg.naturalHeight;
        var ctx = canvas.getContext("2d");
        var isPng = /\.png$/i.test(currentFile.name) || currentFile.type === "image/png";
        if (!isPng) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(currentImg, 0, 0);
        var format = isPng ? "image/png" : "image/jpeg";
        canvas.toBlob(
          function (blob) {
            stripBtn.disabled = false;
            statusLine.textContent = "";
            if (!blob) {
              showBanner(errorBanner, "Stripping failed.");
              return;
            }
            var url = URL.createObjectURL(blob);
            afterPreview.src = url;
            afterSize.textContent = formatBytes(blob.size);
            downloadLink.href = url;
            downloadLink.download = baseName(currentFile.name) + "-clean." + (isPng ? "png" : "jpg");
            outputCard.classList.add("visible");
          },
          format,
          0.95
        );
      } catch (err) {
        stripBtn.disabled = false;
        statusLine.textContent = "";
        showBanner(errorBanner, "Something went wrong: " + err.message);
      }
    }, 20);
  });
})();
