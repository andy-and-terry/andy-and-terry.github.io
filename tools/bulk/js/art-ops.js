/*
 * Registry of the Art Toolkit's algorithms (tools/art/). Each entry points at the
 * *actual* tool page — art-bulk.js loads it into a hidden iframe per variation and
 * drives its real UI (set the seed, click "Regenerate", capture the canvas) rather
 * than reimplementing any of the p5.js drawing code here.
 */
var ART_ALGOS = {
  "flow-field": { label: "Flow Field", page: "../art/flow-field.html", animated: true },
  "particle-orbits": { label: "Particle Orbits", page: "../art/particle-orbits.html", animated: true },
  "voronoi-cells": { label: "Voronoi Cells", page: "../art/voronoi-cells.html", animated: false },
  "recursive-branches": { label: "Recursive Branches", page: "../art/recursive-branches.html", animated: false },
  "wave-interference": { label: "Wave Interference", page: "../art/wave-interference.html", animated: true },
};

var ArtOpsRunner = (function () {
  // Animated sketches accumulate their look over time (trails, drifting waves), so
  // they're left running for a couple seconds of real frames before capture. Static
  // ones (noLoop) finish on the frame after "Regenerate" is clicked.
  var ANIMATED_FRAMES = 110;
  var STATIC_FRAMES = 12;

  function run(algo, seed) {
    var iframe = BulkCommon.createHiddenIframe(algo.page);

    function cleanup() {
      iframe.remove();
    }

    return BulkCommon.waitForLoad(iframe, 20000)
      .then(function () {
        var win = iframe.contentWindow;
        var doc = iframe.contentDocument;
        return BulkCommon.waitFor(
          function () {
            return doc.getElementById("regenerate-btn") ? doc : null;
          },
          10000,
          100
        ).then(function () {
          var seedInput = doc.getElementById("seed-input");
          seedInput.value = seed;
          doc.getElementById("regenerate-btn").click();
          return BulkCommon.waitFrames(win, algo.animated ? ANIMATED_FRAMES : STATIC_FRAMES);
        }).then(function () {
          var canvas = doc.querySelector("#canvas-container canvas");
          if (!canvas) throw new Error("Could not find the rendered canvas.");
          return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
              if (blob) resolve(blob);
              else reject(new Error("Canvas export failed."));
            }, "image/png");
          });
        });
      })
      .then(
        function (blob) {
          cleanup();
          return blob;
        },
        function (err) {
          cleanup();
          throw err;
        }
      );
  }

  return { run: run };
})();
