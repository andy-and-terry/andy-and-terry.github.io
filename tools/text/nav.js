/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["json-formatter.html", "JSON Formatter"],
    ["diff-checker.html", "Diff Checker"],
    ["regex-tester.html", "Regex Tester"],
    ["markdown-preview.html", "Markdown"],
    ["base64-url-encoder.html", "Base64/URL"],
    ["hash-generator.html", "Hash Generator"],
    ["uuid-generator.html", "UUID"],
    ["lorem-ipsum.html", "Lorem Ipsum"],
    ["word-char-counter.html", "Word Counter"],
    ["case-converter.html", "Case Converter"],
  ];
  var nav = document.getElementById("tool-nav");
  if (!nav) return;
  var current = location.pathname.split("/").pop() || "index.html";
  nav.innerHTML = tools
    .map(function (t) {
      var active = t[0] === current;
      return (
        '<a href="' +
        t[0] +
        '"' +
        (active ? ' class="active" aria-current="page"' : "") +
        ">" +
        t[1] +
        "</a>"
      );
    })
    .join("");
})();
