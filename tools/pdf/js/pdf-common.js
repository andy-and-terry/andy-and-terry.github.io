/* Shared helpers used by several PDF tools: pdf.js worker setup, thumbnail rendering, formatting. */
var PdfCommon = (function () {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  async function loadPdfJsDoc(arrayBuffer, password) {
    var task = pdfjsLib.getDocument({ data: arrayBuffer, password: password });
    return task.promise;
  }

  async function renderThumbnail(pdfJsDoc, pageNumber, maxWidth) {
    var page = await pdfJsDoc.getPage(pageNumber);
    var viewport = page.getViewport({ scale: 1 });
    var scale = (maxWidth || 160) / viewport.width;
    var scaledViewport = page.getViewport({ scale: scale });
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaledViewport.width);
    canvas.height = Math.ceil(scaledViewport.height);
    var ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    return canvas;
  }

  function describeLoadError(err) {
    var msg = (err && (err.message || err.name)) || String(err);
    if (/password/i.test(msg)) {
      return "This PDF is password-protected. Remove its password with the Protect tool first, then try again.";
    }
    if (/invalid pdf structure|invalidpdfexception|corrupt/i.test(msg)) {
      return "This file doesn't look like a valid PDF, or it's corrupted.";
    }
    return "Couldn't read this PDF: " + msg;
  }

  function parseRanges(input, pageCount) {
    var ranges = [];
    var parts = input.split(",").map(function (p) { return p.trim(); }).filter(Boolean);
    if (!parts.length) throw new Error("Enter at least one page range, e.g. 1-3.");
    parts.forEach(function (part) {
      var match = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!match) throw new Error('Invalid range "' + part + '". Use formats like 1-3 or 5.');
      var start = parseInt(match[1], 10);
      var end = match[2] ? parseInt(match[2], 10) : start;
      if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
        throw new Error('Range "' + part + '" is out of bounds (document has ' + pageCount + " pages).");
      }
      if (start > end) throw new Error('Range "' + part + '" has a start after its end.');
      ranges.push({ start: start, end: end, label: part });
    });
    return ranges;
  }

  return {
    formatSize: formatSize,
    loadPdfJsDoc: loadPdfJsDoc,
    renderThumbnail: renderThumbnail,
    describeLoadError: describeLoadError,
    parseRanges: parseRanges,
  };
})();
