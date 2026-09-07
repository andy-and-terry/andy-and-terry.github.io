(function () {
  var countEl = document.getElementById("count");
  var caseEl = document.getElementById("case-select");
  var hyphensEl = document.getElementById("hyphens");
  var listEl = document.getElementById("uuid-list");
  var generateBtn = document.getElementById("generate-btn");
  var copyAllBtn = document.getElementById("copy-all-btn");

  var MAX_COUNT = 1000;
  var current = [];

  function uuidv4() {
    // Use the native generator when available, else build one from getRandomValues.
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    var bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    var hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return (
      hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20)
    );
  }

  function format(id) {
    var out = hyphensEl.checked ? id : id.replace(/-/g, "");
    return caseEl.value === "upper" ? out.toUpperCase() : out.toLowerCase();
  }

  function render() {
    listEl.innerHTML = "";
    current.forEach(function (id, idx) {
      var item = document.createElement("div");
      item.className = "uuid-item";
      var span = document.createElement("span");
      span.textContent = format(id);
      var btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.type = "button";
      btn.textContent = "Copy";
      btn.addEventListener("click", function (e) {
        copyText(format(id), e.currentTarget);
      });
      item.appendChild(span);
      item.appendChild(btn);
      listEl.appendChild(item);
    });
  }

  function generate() {
    var n = parseInt(countEl.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    if (n > MAX_COUNT) n = MAX_COUNT;
    countEl.value = n;
    current = [];
    for (var i = 0; i < n; i++) current.push(uuidv4());
    render();
  }

  generateBtn.addEventListener("click", generate);
  caseEl.addEventListener("change", render);
  hyphensEl.addEventListener("change", render);
  countEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") generate();
  });

  copyAllBtn.addEventListener("click", function (e) {
    copyText(current.map(format).join("\n"), e.currentTarget);
  });

  generate();
})();
