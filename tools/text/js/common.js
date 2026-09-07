/* Shared helpers for the text/dev toolkit tool pages. */

// Copies text to the clipboard, with a fallback for contexts where the
// Clipboard API is unavailable, and briefly flashes the trigger button.
function copyText(text, btn) {
  function flash() {
    if (!btn) return;
    var original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1200);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(flash, function () {
      fallbackCopy(text, flash);
    });
  } else {
    fallbackCopy(text, flash);
  }
}

function fallbackCopy(text, done) {
  try {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (done) done();
  } catch (e) {
    /* clipboard unavailable; silently no-op */
  }
}

// Minimal HTML-escaping helper used by several tools to render user text safely.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
