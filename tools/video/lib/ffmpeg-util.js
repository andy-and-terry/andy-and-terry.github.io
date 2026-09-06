/*
 * Standalone build of @ffmpeg/util (fetchFile / toBlobURL / downloadWithProgress / importScript).
 * The published npm "umd" build of this package ships broken CJS internals (bare `exports`/`require`
 * calls) that throw when loaded via a plain <script> tag, so this is a from-source rebuild exposing
 * the same API as `window.FFmpegUtil`, matching @ffmpeg/util 0.12.x's behavior.
 */
(function (global) {
  "use strict";

  function readFromBlobOrFile(blob) {
    return new Promise(function (resolve, reject) {
      var fileReader = new FileReader();
      fileReader.onload = function () {
        var result = fileReader.result;
        if (result instanceof ArrayBuffer) {
          resolve(new Uint8Array(result));
        } else {
          resolve(new Uint8Array());
        }
      };
      fileReader.onerror = function (event) {
        var err = event && event.target && event.target.error;
        reject(new Error("File could not be read! Code=" + (err && err.code != null ? err.code : -1)));
      };
      fileReader.readAsArrayBuffer(blob);
    });
  }

  async function fetchFile(file) {
    var data;
    if (typeof file === "string") {
      if (/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(file)) {
        data = atob(file.split(",")[1])
          .split("")
          .map(function (c) {
            return c.charCodeAt(0);
          });
      } else {
        data = await (await fetch(file)).arrayBuffer();
      }
    } else if (file instanceof URL) {
      data = await (await fetch(file)).arrayBuffer();
    } else if (file instanceof File || file instanceof Blob) {
      data = await readFromBlobOrFile(file);
    } else {
      return new Uint8Array();
    }
    return new Uint8Array(data);
  }

  function importScript(url) {
    return new Promise(function (resolve) {
      var script = document.createElement("script");
      var handler = function () {
        script.removeEventListener("load", handler);
        resolve();
      };
      script.src = url;
      script.type = "text/javascript";
      script.addEventListener("load", handler);
      document.getElementsByTagName("head")[0].appendChild(script);
    });
  }

  async function downloadWithProgress(url, cb) {
    var resp = await fetch(url);
    var buf;
    try {
      var total = parseInt(resp.headers.get("Content-Length") || "-1", 10);
      var reader = resp.body && resp.body.getReader();
      if (!reader) throw new Error("failed to get response body reader");
      var chunks = [];
      var received = 0;
      for (;;) {
        var res = await reader.read();
        var done = res.done;
        var value = res.value;
        var delta = value ? value.length : 0;
        if (done) {
          if (total != -1 && total !== received) throw new Error("failed to complete download");
          cb && cb({ url: url, total: total, received: received, delta: delta, done: done });
          break;
        }
        chunks.push(value);
        received += delta;
        cb && cb({ url: url, total: total, received: received, delta: delta, done: done });
      }
      var data = new Uint8Array(received);
      var position = 0;
      for (var i = 0; i < chunks.length; i++) {
        data.set(chunks[i], position);
        position += chunks[i].length;
      }
      buf = data.buffer;
    } catch (e) {
      buf = await resp.arrayBuffer();
      cb &&
        cb({
          url: url,
          total: buf.byteLength,
          received: buf.byteLength,
          delta: 0,
          done: true,
        });
    }
    return buf;
  }

  async function toBlobURL(url, mimeType, progress, cb) {
    var buf = progress ? await downloadWithProgress(url, cb) : await (await fetch(url)).arrayBuffer();
    var blob = new Blob([buf], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  global.FFmpegUtil = {
    fetchFile: fetchFile,
    importScript: importScript,
    downloadWithProgress: downloadWithProgress,
    toBlobURL: toBlobURL,
  };
})(typeof self !== "undefined" ? self : this);
