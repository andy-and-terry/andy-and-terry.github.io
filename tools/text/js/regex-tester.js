(function () {
  var patternEl = document.getElementById("pattern");
  var flagsEl = document.getElementById("flags");
  var testStringEl = document.getElementById("test-string");
  var errorEl = document.getElementById("regex-error");
  var summaryEl = document.getElementById("match-summary");
  var highlightedEl = document.getElementById("highlighted-output");
  var groupsCard = document.getElementById("groups-card");
  var matchListEl = document.getElementById("match-list");

  var MAX_MATCHES = 2000; // guard against catastrophic/zero-width-loop patterns

  function render() {
    var patternSrc = patternEl.value;
    var flags = flagsEl.value;
    var text = testStringEl.value;

    errorEl.hidden = true;
    groupsCard.hidden = true;
    matchListEl.innerHTML = "";

    if (patternSrc === "") {
      highlightedEl.textContent = text;
      summaryEl.textContent = "Enter a pattern above to start matching.";
      return;
    }

    // Always ensure 'g' so we can iterate all matches without infinite-looping lastIndex.
    var iterFlags = flags.indexOf("g") === -1 ? flags + "g" : flags;

    var re;
    try {
      re = new RegExp(patternSrc, iterFlags);
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = "Invalid regular expression: " + err.message;
      highlightedEl.textContent = text;
      summaryEl.textContent = "";
      return;
    }

    var matches = [];
    var lastIndex = 0;
    var htmlParts = [];
    var m;
    var guard = 0;

    while ((m = re.exec(text)) !== null) {
      guard++;
      if (guard > MAX_MATCHES) {
        break;
      }
      htmlParts.push(escapeHtml(text.slice(lastIndex, m.index)));
      var cls = matches.length % 2 === 0 ? "match" : "match match-alt";
      htmlParts.push('<mark class="' + cls + '">' + escapeHtml(m[0] || "") + "</mark>");
      lastIndex = m.index + m[0].length;
      matches.push(m);

      // Avoid infinite loop on zero-length matches.
      if (m[0].length === 0) {
        re.lastIndex++;
      }
    }
    htmlParts.push(escapeHtml(text.slice(lastIndex)));
    highlightedEl.innerHTML = text === "" ? "" : htmlParts.join("");

    if (matches.length === 0) {
      summaryEl.textContent = "No matches.";
      return;
    }

    summaryEl.textContent =
      matches.length + " match" + (matches.length === 1 ? "" : "es") + (guard > MAX_MATCHES ? " (truncated at " + MAX_MATCHES + ")" : "");

    groupsCard.hidden = false;
    matches.forEach(function (mm, idx) {
      var item = document.createElement("div");
      item.className = "match-item";

      var idxLine = document.createElement("div");
      idxLine.className = "idx";
      idxLine.textContent = "Match " + (idx + 1) + " at index " + mm.index;
      item.appendChild(idxLine);

      var full = document.createElement("div");
      full.innerHTML = '<span class="group">full: </span>' + escapeHtml(JSON.stringify(mm[0]));
      item.appendChild(full);

      for (var g = 1; g < mm.length; g++) {
        var groupLine = document.createElement("div");
        var val = mm[g] === undefined ? "undefined" : JSON.stringify(mm[g]);
        groupLine.innerHTML = '<span class="group">group ' + g + ": </span>" + escapeHtml(val);
        item.appendChild(groupLine);
      }

      if (mm.groups) {
        Object.keys(mm.groups).forEach(function (name) {
          var val = mm.groups[name] === undefined ? "undefined" : JSON.stringify(mm.groups[name]);
          var namedLine = document.createElement("div");
          namedLine.innerHTML = '<span class="group">&lt;' + escapeHtml(name) + "&gt;: </span>" + escapeHtml(val);
          item.appendChild(namedLine);
        });
      }

      matchListEl.appendChild(item);
    });
  }

  patternEl.addEventListener("input", render);
  flagsEl.addEventListener("input", render);
  testStringEl.addEventListener("input", render);
  render();
})();
