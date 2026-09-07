/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["trim-convert.html", "Trim / Convert"],
    ["volume-normalize.html", "Normalize"],
    ["silence-remove.html", "Silence Remove"],
    ["merge.html", "Merge"],
    ["pitch-speed.html", "Pitch / Speed"],
    ["waveform-to-video.html", "Waveform Video"],
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
