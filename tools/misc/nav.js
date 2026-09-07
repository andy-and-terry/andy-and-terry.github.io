/* Renders the consistent top nav on every tool page. Include after an element with id="tool-nav". */
(function () {
  var tools = [
    ["qr-code.html", "QR Code"],
    ["qr-scanner.html", "QR Scanner"],
    ["barcode-generator.html", "Barcode"],
    ["color-tools.html", "Color Tools"],
    ["unit-converter.html", "Unit Converter"],
    ["password-generator.html", "Password"],
    ["timestamp-converter.html", "Timestamp"],
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
