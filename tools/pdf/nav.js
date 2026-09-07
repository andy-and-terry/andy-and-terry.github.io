/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["merge.html", "Merge"],
    ["split.html", "Split"],
    ["compress.html", "Compress"],
    ["image-to-pdf.html", "Image → PDF"],
    ["pdf-to-image.html", "PDF → Image"],
    ["rotate-reorder.html", "Rotate/Reorder"],
    ["protect.html", "Protect"],
    ["extract-text.html", "Extract Text"],
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
