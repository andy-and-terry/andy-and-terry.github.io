(function () {
  var input = document.getElementById("input");
  var errorBanner = document.getElementById("error-banner");
  var outputCard = document.getElementById("output-card");
  var treeCard = document.getElementById("tree-card");
  var formattedOutput = document.getElementById("formatted-output");
  var treeRoot = document.getElementById("tree-root");
  var minifyToggle = document.getElementById("minify-toggle");
  var minified = false;

  document.getElementById("sample-btn").addEventListener("click", function () {
    input.value = JSON.stringify(
      {
        name: "Text Toolkit",
        version: 1,
        tags: ["json", "dev", "browser"],
        active: true,
        meta: { author: "you", nested: { deep: [1, 2, { ok: null }] } },
      },
      null,
      2
    );
    render();
  });

  document.getElementById("clear-btn").addEventListener("click", function () {
    input.value = "";
    render();
    input.focus();
  });

  minifyToggle.addEventListener("click", function () {
    minified = !minified;
    minifyToggle.setAttribute("aria-pressed", String(minified));
    minifyToggle.classList.toggle("btn-primary", minified);
    minifyToggle.classList.toggle("btn-secondary", !minified);
    render();
  });

  document.getElementById("copy-formatted").addEventListener("click", function (e) {
    copyText(formattedOutput.textContent, e.currentTarget);
  });

  document.getElementById("expand-all").addEventListener("click", function () {
    treeRoot.querySelectorAll(".collapsed").forEach(function (el) {
      el.classList.remove("collapsed");
    });
  });

  document.getElementById("collapse-all").addEventListener("click", function () {
    treeRoot.querySelectorAll(".json-node.container").forEach(function (el) {
      el.classList.add("collapsed");
    });
  });

  // Finds the {line, column} for a character offset within a string.
  function lineColFromOffset(str, offset) {
    var line = 1;
    var col = 1;
    for (var i = 0; i < offset && i < str.length; i++) {
      if (str[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    return { line: line, col: col };
  }

  function describeError(err, text) {
    var msg = err.message || String(err);
    // Some engines already include a line/column in the message; don't double it up.
    if (/line \d+ column \d+/i.test(msg)) return msg;
    var m = msg.match(/position (\d+)/i);
    if (m) {
      var pos = parseInt(m[1], 10);
      var lc = lineColFromOffset(text, pos);
      return msg + " (line " + lc.line + ", column " + lc.col + ")";
    }
    return msg;
  }

  function render() {
    var text = input.value;
    errorBanner.hidden = true;
    outputCard.hidden = true;
    treeCard.hidden = true;

    if (text.trim() === "") {
      return;
    }

    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      errorBanner.hidden = false;
      errorBanner.textContent = "Invalid JSON: " + describeError(err, text);
      return;
    }

    formattedOutput.textContent = minified ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);
    outputCard.hidden = false;

    treeRoot.innerHTML = "";
    treeRoot.appendChild(buildTree(parsed, true));
    treeCard.hidden = false;
  }

  function typeClass(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    var t = typeof v;
    if (t === "object") return "object";
    return t;
  }

  function valueNode(v) {
    var span = document.createElement("span");
    var t = typeClass(v);
    if (t === "string") {
      span.className = "str";
      span.textContent = JSON.stringify(v);
    } else if (t === "number") {
      span.className = "num";
      span.textContent = String(v);
    } else if (t === "boolean") {
      span.className = "bool";
      span.textContent = String(v);
    } else if (t === "null") {
      span.className = "null";
      span.textContent = "null";
    }
    return span;
  }

  // Builds a DOM subtree representing a JSON value, collapsible for objects/arrays.
  function buildTree(value, isRoot) {
    var t = typeClass(value);
    if (t !== "object" && t !== "array") {
      var wrap = document.createElement("div");
      wrap.appendChild(valueNode(value));
      return wrap;
    }

    var isArray = t === "array";
    var entries = isArray ? value.map(function (v, i) { return [i, v]; }) : Object.keys(value).map(function (k) { return [k, value[k]]; });

    var node = document.createElement("div");
    node.className = "json-node container";

    var header = document.createElement("span");
    var toggle = document.createElement("span");
    toggle.className = "toggle";
    toggle.textContent = entries.length ? "▾" : " ";
    header.appendChild(toggle);

    var openBracket = document.createElement("span");
    openBracket.className = "bracket";
    openBracket.textContent = isArray ? "[" : "{";
    header.appendChild(openBracket);

    var count = document.createElement("span");
    count.className = "count";
    count.textContent = entries.length + (isArray ? (entries.length === 1 ? " item" : " items") : (entries.length === 1 ? " key" : " keys"));
    header.appendChild(count);

    header.style.cursor = entries.length ? "pointer" : "default";
    if (entries.length) {
      header.addEventListener("click", function (e) {
        node.classList.toggle("collapsed");
      });
    }
    node.appendChild(header);

    if (entries.length) {
      var ul = document.createElement("ul");
      entries.forEach(function (pair) {
        var key = pair[0];
        var val = pair[1];
        var li = document.createElement("li");
        if (!isArray) {
          var keySpan = document.createElement("span");
          keySpan.className = "key";
          keySpan.textContent = JSON.stringify(String(key));
          li.appendChild(keySpan);
          var colon = document.createElement("span");
          colon.className = "bracket";
          colon.textContent = ": ";
          li.appendChild(colon);
        }
        var childType = typeClass(val);
        if (childType === "object" || childType === "array") {
          li.appendChild(buildTree(val, false));
        } else {
          li.appendChild(valueNode(val));
        }
        ul.appendChild(li);
      });
      node.appendChild(ul);
    }

    var closeBracket = document.createElement("span");
    closeBracket.className = "bracket";
    closeBracket.textContent = isArray ? "]" : "}";
    node.appendChild(closeBracket);

    return node;
  }

  input.addEventListener("input", render);
  render();
})();
