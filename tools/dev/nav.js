/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["jwt-decoder.html", "JWT Decoder"],
    ["cron-parser.html", "Cron Parser"],
    ["http-status-lookup.html", "HTTP Status Codes"],
    ["css-gradient-generator.html", "CSS Gradient"],
    ["meta-tag-preview.html", "Meta Tag Preview"],
    ["markdown-table-generator.html", "Markdown Table"],
    ["gitignore-generator.html", ".gitignore"],
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
