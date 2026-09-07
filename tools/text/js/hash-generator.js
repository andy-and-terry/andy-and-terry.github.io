(function () {
  var textInput = document.getElementById("text-input");
  var dropZone = document.getElementById("drop-zone");
  var fileInput = document.getElementById("file-input");
  var fileInfo = document.getElementById("file-info");
  var fileNameEl = document.getElementById("file-name");
  var fileSizeEl = document.getElementById("file-size");
  var clearFileBtn = document.getElementById("clear-file");
  var status = document.getElementById("hash-status");
  var results = document.getElementById("hash-results");

  var currentFile = null;
  var runToken = 0; // guards against out-of-order async results

  var ALGOS = [
    { label: "MD5", key: "md5" },
    { label: "SHA-1", key: "sha1", subtle: "SHA-1" },
    { label: "SHA-256", key: "sha256", subtle: "SHA-256" },
    { label: "SHA-512", key: "sha512", subtle: "SHA-512" },
  ];

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(2) + " MB";
  }

  function buildRows() {
    results.innerHTML = "";
    ALGOS.forEach(function (algo) {
      var row = document.createElement("div");
      row.className = "case-row";
      row.id = "row-" + algo.key;
      row.innerHTML =
        '<div class="case-label"><span>' +
        algo.label +
        '</span><button class="copy-btn" type="button">Copy</button></div>' +
        '<div class="case-value" id="value-' +
        algo.key +
        '">&mdash;</div>';
      results.appendChild(row);
      row.querySelector(".copy-btn").addEventListener("click", function (e) {
        var val = document.getElementById("value-" + algo.key).textContent;
        if (val && val !== "—") copyText(val, e.currentTarget);
      });
    });
  }
  buildRows();

  function setValue(key, text) {
    var el = document.getElementById("value-" + key);
    if (el) el.textContent = text;
  }

  function bufToHex(buf) {
    var bytes = new Uint8Array(buf);
    var hex = "";
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
    return hex;
  }

  function computeAll(bytes) {
    var token = ++runToken;
    ALGOS.forEach(function (a) {
      setValue(a.key, "computing…");
    });

    // MD5 is synchronous vanilla JS.
    try {
      setValue("md5", md5(bytes));
    } catch (e) {
      setValue("md5", "error: " + e.message);
    }

    if (!(window.crypto && window.crypto.subtle)) {
      status.textContent = "SubtleCrypto isn't available in this context (e.g. non-HTTPS), so SHA hashes can't be computed.";
      ALGOS.slice(1).forEach(function (a) {
        setValue(a.key, "unavailable");
      });
      return;
    }

    status.textContent = "";
    ALGOS.slice(1).forEach(function (a) {
      window.crypto.subtle
        .digest(a.subtle, bytes)
        .then(function (buf) {
          if (token !== runToken) return; // stale
          setValue(a.key, bufToHex(buf));
        })
        .catch(function (err) {
          if (token !== runToken) return;
          setValue(a.key, "error: " + err.message);
        });
    });
  }

  function runOnText() {
    var text = textInput.value;
    if (text === "") {
      ALGOS.forEach(function (a) {
        setValue(a.key, "—");
      });
      status.textContent = "";
      return;
    }
    computeAll(new TextEncoder().encode(text));
  }

  function runOnFile(file) {
    status.textContent = "Reading file…";
    file
      .arrayBuffer()
      .then(function (buf) {
        status.textContent = "";
        computeAll(new Uint8Array(buf));
      })
      .catch(function (err) {
        status.textContent = "Could not read file: " + err.message;
      });
  }

  textInput.addEventListener("input", function () {
    if (currentFile) return; // file mode takes precedence until cleared
    runOnText();
  });

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });
  dropZone.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      useFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) {
      useFile(fileInput.files[0]);
    }
  });

  function useFile(file) {
    currentFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatBytes(file.size);
    fileInfo.hidden = false;
    runOnFile(file);
  }

  clearFileBtn.addEventListener("click", function () {
    currentFile = null;
    fileInput.value = "";
    fileInfo.hidden = true;
    runOnText();
  });

  runOnText();
})();
