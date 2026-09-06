/* Recursive Branches: a branching structure grown by recursive subdivision with randomized angle and length. */
(function () {
  var CANVAS_SIZE = 900;
  var container = document.getElementById("canvas-container");

  var seedInput = document.getElementById("seed-input");
  var shuffleBtn = document.getElementById("shuffle-seed-btn");
  var regenerateBtn = document.getElementById("regenerate-btn");
  var downloadBtn = document.getElementById("download-btn");

  var depthRange = document.getElementById("depth-range");
  var angleRange = document.getElementById("angle-range");
  var jitterRange = document.getElementById("jitter-range");
  var ratioRange = document.getElementById("ratio-range");
  var splitRange = document.getElementById("split-range");
  var hueRange = document.getElementById("hue-range");

  ArtCommon.bindRangeLabel(depthRange, document.getElementById("depth-value"));
  ArtCommon.bindRangeLabel(angleRange, document.getElementById("angle-value"), function (v) {
    return v + "°";
  });
  ArtCommon.bindRangeLabel(jitterRange, document.getElementById("jitter-value"), function (v) {
    return v + "°";
  });
  ArtCommon.bindRangeLabel(ratioRange, document.getElementById("ratio-value"), function (v) {
    return parseFloat(v).toFixed(2);
  });
  ArtCommon.bindRangeLabel(splitRange, document.getElementById("split-value"), function (v) {
    return parseFloat(v).toFixed(2);
  });
  ArtCommon.bindRangeLabel(hueRange, document.getElementById("hue-value"), function (v) {
    return v + "°";
  });

  var params = {};
  function readParams() {
    params.maxDepth = parseInt(depthRange.value, 10);
    params.branchAngle = (parseFloat(angleRange.value) * Math.PI) / 180;
    params.angleJitter = (parseFloat(jitterRange.value) * Math.PI) / 180;
    params.lengthRatio = parseFloat(ratioRange.value);
    params.splitChance = parseFloat(splitRange.value);
    params.hue = parseInt(hueRange.value, 10);
  }

  var myp5 = null;

  function branch(p, x, y, len, angle, depth) {
    if (depth <= 0 || len < 2) return;
    var x2 = x + len * Math.cos(angle);
    var y2 = y + len * Math.sin(angle);
    var t = depth / params.maxDepth;

    p.stroke((params.hue + (1 - t) * 50) % 360, 50, 35 + 55 * t);
    p.strokeWeight(p.map(depth, 0, params.maxDepth, 0.6, 7));
    p.line(x, y, x2, y2);

    var nextLen = len * params.lengthRatio;
    var jitter = params.angleJitter;

    branch(p, x2, y2, nextLen, angle - params.branchAngle + p.random(-jitter, jitter), depth - 1);
    branch(p, x2, y2, nextLen, angle + params.branchAngle + p.random(-jitter, jitter), depth - 1);
    if (p.random() < params.splitChance) {
      branch(p, x2, y2, nextLen * 0.8, angle + p.random(-jitter, jitter), depth - 1);
    }
  }

  function reset(seed) {
    readParams();
    if (!myp5) return;
    var p = myp5;
    p.randomSeed(seed);
    p.background(params.hue, 25, 6);
    var startLen = CANVAS_SIZE * 0.26;
    branch(p, CANVAS_SIZE / 2, CANVAS_SIZE * 0.96, startLen, -Math.PI / 2, params.maxDepth);
  }

  var sketch = function (p) {
    p.setup = function () {
      var c = p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      c.parent(container);
      p.pixelDensity(2);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.noLoop();
      reset(parseInt(seedInput.value, 10) || 0);
    };
  };

  ArtCommon.setupSeedControls({
    seedInput: seedInput,
    shuffleBtn: shuffleBtn,
    regenerateBtn: regenerateBtn,
    onRegenerate: reset,
  });

  [depthRange, angleRange, jitterRange, ratioRange, splitRange, hueRange].forEach(function (el) {
    el.addEventListener("input", function () {
      reset(parseInt(seedInput.value, 10) || 0);
    });
  });

  downloadBtn.addEventListener("click", function () {
    var canvas = container.querySelector("canvas");
    ArtCommon.downloadCanvas(canvas, "recursive-branches-seed" + seedInput.value + ".png");
  });

  myp5 = new p5(sketch);
})();
