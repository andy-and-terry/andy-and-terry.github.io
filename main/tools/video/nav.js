/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["trim.html", "Trim"],
    ["compress.html", "Compress"],
    ["merge.html", "Merge"],
    ["speed.html", "Speed"],
    ["rotate-flip.html", "Rotate/Flip"],
    ["extract-frame.html", "Extract Frame"],
    ["audio.html", "Audio"],
    ["crop.html", "Crop"],
    ["watermark.html", "Watermark"],
    ["reverse.html", "Reverse"],
    ["subtitles.html", "Subtitles"],
    ["color-adjust.html", "Color"],
    ["boomerang.html", "Boomerang"],
    ["slideshow.html", "Slideshow"],
    ["denoise.html", "Denoise"],
    ["thumbnail-grid.html", "Thumbnails"],
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
