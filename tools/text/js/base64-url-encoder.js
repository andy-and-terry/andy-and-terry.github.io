(function () {
  var input = document.getElementById("input");
  var detectHint = document.getElementById("detect-hint");

  var b64EncodeOut = document.getElementById("b64-encode-output");
  var b64DecodeOut = document.getElementById("b64-decode-output");
  var b64DecodeErr = document.getElementById("b64-decode-error");
  var urlEncodeOut = document.getElementById("url-encode-output");
  var urlDecodeOut = document.getElementById("url-decode-output");
  var urlDecodeErr = document.getElementById("url-decode-error");

  // UTF-8 safe base64 encode/decode using TextEncoder/TextDecoder.
  function b64Encode(str) {
    var bytes = new TextEncoder().encode(str);
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function b64Decode(str) {
    var binary = atob(str); // throws on invalid input
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function looksLikeBase64(str) {
    var s = str.trim();
    if (s === "") return false;
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(s)) return false;
    if (s.length % 4 !== 0 && !/^[A-Za-z0-9_-]+$/.test(s)) return false;
    return true;
  }

  function looksLikeUrlEncoded(str) {
    return /%[0-9A-Fa-f]{2}/.test(str);
  }

  function setCopyHandler(btnId, getText) {
    document.getElementById(btnId).addEventListener("click", function (e) {
      copyText(getText(), e.currentTarget);
    });
  }

  setCopyHandler("copy-b64-encode", function () { return b64EncodeOut.textContent; });
  setCopyHandler("copy-b64-decode", function () { return b64DecodeOut.textContent; });
  setCopyHandler("copy-url-encode", function () { return urlEncodeOut.textContent; });
  setCopyHandler("copy-url-decode", function () { return urlDecodeOut.textContent; });

  function render() {
    var text = input.value;

    // Base64 encode (always possible for any text).
    try {
      b64EncodeOut.textContent = text === "" ? "" : b64Encode(text);
    } catch (e) {
      b64EncodeOut.textContent = "";
    }

    // Base64 decode.
    b64DecodeErr.hidden = true;
    if (text.trim() === "") {
      b64DecodeOut.textContent = "";
    } else {
      try {
        b64DecodeOut.textContent = b64Decode(text.trim());
      } catch (e) {
        b64DecodeOut.textContent = "";
        b64DecodeErr.hidden = false;
        b64DecodeErr.textContent = "Not valid Base64 (or not valid UTF-8 once decoded): " + e.message;
      }
    }

    // URL encode.
    try {
      urlEncodeOut.textContent = text === "" ? "" : encodeURIComponent(text);
    } catch (e) {
      urlEncodeOut.textContent = "";
    }

    // URL decode.
    urlDecodeErr.hidden = true;
    if (text.trim() === "") {
      urlDecodeOut.textContent = "";
    } else {
      try {
        urlDecodeOut.textContent = decodeURIComponent(text.replace(/\+/g, " "));
      } catch (e) {
        urlDecodeOut.textContent = "";
        urlDecodeErr.hidden = false;
        urlDecodeErr.textContent = "Not valid percent-encoded (URL-encoded) text: " + e.message;
      }
    }

    // Auto-detect hint.
    if (text.trim() === "") {
      detectHint.textContent = "";
    } else if (looksLikeUrlEncoded(text)) {
      detectHint.textContent = "Looks like URL-encoded text — check the URL decode result below.";
    } else if (looksLikeBase64(text)) {
      detectHint.textContent = "Looks like Base64 — check the Base64 decode result below.";
    } else {
      detectHint.textContent = "Doesn't look like Base64 or URL-encoded — showing encode results for plain text.";
    }
  }

  input.addEventListener("input", render);
  render();
})();
