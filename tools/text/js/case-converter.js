(function () {
  var input = document.getElementById("input");
  var results = document.getElementById("results");

  // Splits arbitrary text into words, handling spaces, hyphens, underscores,
  // and camelCase/PascalCase boundaries.
  function splitWords(text) {
    var normalized = text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/[_\-]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ");
    var words = normalized.trim().split(/\s+/).filter(Boolean);
    return words.map(function (w) { return w.toLowerCase(); });
  }

  var CONVERTERS = [
    {
      key: "camel",
      label: "camelCase",
      convert: function (words) {
        return words
          .map(function (w, i) { return i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1); })
          .join("");
      },
    },
    {
      key: "pascal",
      label: "PascalCase",
      convert: function (words) {
        return words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join("");
      },
    },
    {
      key: "snake",
      label: "snake_case",
      convert: function (words) {
        return words.join("_");
      },
    },
    {
      key: "kebab",
      label: "kebab-case",
      convert: function (words) {
        return words.join("-");
      },
    },
    {
      key: "constant",
      label: "CONSTANT_CASE",
      convert: function (words) {
        return words.join("_").toUpperCase();
      },
    },
    {
      key: "title",
      label: "Title Case",
      convert: function (words) {
        return words.map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
      },
    },
    {
      key: "sentence",
      label: "Sentence case",
      convert: function (words) {
        var s = words.join(" ");
        return s.charAt(0).toUpperCase() + s.slice(1);
      },
    },
    {
      key: "lower",
      label: "lower case",
      convert: function (words) {
        return words.join(" ");
      },
    },
    {
      key: "upper",
      label: "UPPER CASE",
      convert: function (words) {
        return words.join(" ").toUpperCase();
      },
    },
    {
      key: "dot",
      label: "dot.case",
      convert: function (words) {
        return words.join(".");
      },
    },
  ];

  function buildRows() {
    results.innerHTML = "";
    CONVERTERS.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "case-row";
      row.innerHTML =
        '<div class="case-label"><span>' +
        c.label +
        '</span><button class="copy-btn" type="button">Copy</button></div>' +
        '<div class="case-value" id="value-' +
        c.key +
        '"></div>';
      results.appendChild(row);
      row.querySelector(".copy-btn").addEventListener("click", function (e) {
        var val = document.getElementById("value-" + c.key).textContent;
        copyText(val, e.currentTarget);
      });
    });
  }
  buildRows();

  function render() {
    var text = input.value;
    var words = splitWords(text);
    CONVERTERS.forEach(function (c) {
      var el = document.getElementById("value-" + c.key);
      el.textContent = words.length === 0 ? "" : c.convert(words);
    });
  }

  input.addEventListener("input", render);
  render();
})();
