/* Renders the consistent top nav on every bulk tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["video-bulk.html", "Video Bulk"],
    ["art-bulk.html", "Art Bulk"],
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
