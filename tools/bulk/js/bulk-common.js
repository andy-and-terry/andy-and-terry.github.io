/* Small helpers shared by video-ops.js and art-ops.js for driving a real tool page inside a hidden iframe. */
var BulkCommon = (function () {
  function waitFor(check, timeoutMs, intervalMs) {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function poll() {
        var v;
        try {
          v = check();
        } catch (e) {
          v = undefined;
        }
        if (v) return resolve(v);
        if (Date.now() - start > timeoutMs) return reject(new Error("Timed out waiting."));
        setTimeout(poll, intervalMs || 150);
      })();
    });
  }

  function waitForLoad(iframe, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          reject(new Error("Tool page took too long to load."));
        }
      }, timeoutMs);
      iframe.addEventListener("load", function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Resolves after `n` real animation frames have ticked on the iframe's own timeline. */
  function waitFrames(win, n) {
    return new Promise(function (resolve) {
      var count = 0;
      function step() {
        count++;
        if (count >= n) resolve();
        else win.requestAnimationFrame(step);
      }
      win.requestAnimationFrame(step);
    });
  }

  function createHiddenIframe(src) {
    var iframe = document.createElement("iframe");
    iframe.className = "worker-frame";
    document.body.appendChild(iframe);
    iframe.src = src;
    return iframe;
  }

  return {
    waitFor: waitFor,
    waitForLoad: waitForLoad,
    waitFrames: waitFrames,
    createHiddenIframe: createHiddenIframe,
  };
})();
