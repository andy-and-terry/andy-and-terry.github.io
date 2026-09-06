/* Voronoi Cells: grid-approximated Voronoi diagram over random seed points, with optional Lloyd relaxation. */
(function () {
  var CANVAS_SIZE = 900;
  var container = document.getElementById("canvas-container");

  var seedInput = document.getElementById("seed-input");
  var shuffleBtn = document.getElementById("shuffle-seed-btn");
  var regenerateBtn = document.getElementById("regenerate-btn");
  var downloadBtn = document.getElementById("download-btn");
  var statusEl = document.getElementById("compute-status");

  var cellsRange = document.getElementById("cells-range");
  var relaxRange = document.getElementById("relax-range");
  var resolutionRange = document.getElementById("resolution-range");
  var borderRange = document.getElementById("border-range");
  var hueRange = document.getElementById("hue-range");
  var spreadRange = document.getElementById("spread-range");

  ArtCommon.bindRangeLabel(cellsRange, document.getElementById("cells-value"));
  ArtCommon.bindRangeLabel(relaxRange, document.getElementById("relax-value"));
  ArtCommon.bindRangeLabel(resolutionRange, document.getElementById("resolution-value"), function (v) {
    return v + "px";
  });
  ArtCommon.bindRangeLabel(borderRange, document.getElementById("border-value"));
  ArtCommon.bindRangeLabel(hueRange, document.getElementById("hue-value"), function (v) {
    return v + "°";
  });
  ArtCommon.bindRangeLabel(spreadRange, document.getElementById("spread-value"), function (v) {
    return v + "°";
  });

  var params = {};
  function readParams() {
    params.cellCount = parseInt(cellsRange.value, 10);
    params.relaxSteps = parseInt(relaxRange.value, 10);
    params.cellSize = parseInt(resolutionRange.value, 10);
    params.border = parseFloat(borderRange.value);
    params.hue = parseInt(hueRange.value, 10);
    params.spread = parseInt(spreadRange.value, 10);
  }

  var sites = [];
  var owner = null;
  var cols = 0;
  var rows = 0;
  var myp5 = null;

  function computeOwnership() {
    cols = Math.ceil(CANVAS_SIZE / params.cellSize);
    rows = Math.ceil(CANVAS_SIZE / params.cellSize);
    owner = new Int32Array(cols * rows);
    var half = params.cellSize / 2;
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var x = gx * params.cellSize + half;
        var y = gy * params.cellSize + half;
        var best = 0;
        var bestD = Infinity;
        for (var i = 0; i < sites.length; i++) {
          var dx = sites[i].x - x;
          var dy = sites[i].y - y;
          var d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        owner[gy * cols + gx] = best;
      }
    }
  }

  function relaxSites(p) {
    var half = params.cellSize / 2;
    var sumX = new Float64Array(sites.length);
    var sumY = new Float64Array(sites.length);
    var count = new Int32Array(sites.length);
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var idx = owner[gy * cols + gx];
        sumX[idx] += gx * params.cellSize + half;
        sumY[idx] += gy * params.cellSize + half;
        count[idx]++;
      }
    }
    for (var i = 0; i < sites.length; i++) {
      if (count[i] === 0) continue;
      sites[i].x = p.lerp(sites[i].x, sumX[i] / count[i], 0.6);
      sites[i].y = p.lerp(sites[i].y, sumY[i] / count[i], 0.6);
    }
  }

  function render(p) {
    p.noStroke();
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var site = sites[owner[gy * cols + gx]];
        var hue = (params.hue + site.t * params.spread) % 360;
        p.fill(hue, 55, 62);
        p.rect(gx * params.cellSize, gy * params.cellSize, params.cellSize, params.cellSize);
      }
    }

    if (params.border > 0) {
      p.stroke(220, 15, 8);
      p.strokeWeight(params.border);
      for (var y2 = 0; y2 < rows; y2++) {
        for (var x2 = 0; x2 < cols; x2++) {
          var idx = owner[y2 * cols + x2];
          if (x2 + 1 < cols && owner[y2 * cols + x2 + 1] !== idx) {
            var lx = (x2 + 1) * params.cellSize;
            p.line(lx, y2 * params.cellSize, lx, (y2 + 1) * params.cellSize);
          }
          if (y2 + 1 < rows && owner[(y2 + 1) * cols + x2] !== idx) {
            var ly = (y2 + 1) * params.cellSize;
            p.line(x2 * params.cellSize, ly, (x2 + 1) * params.cellSize, ly);
          }
        }
      }
    }

    p.noStroke();
    p.fill(220, 10, 5, 55);
    for (var i = 0; i < sites.length; i++) {
      p.circle(sites[i].x, sites[i].y, 3);
    }
  }

  function fullRebuild(seed) {
    readParams();
    if (!myp5) return;
    statusEl.textContent = "Computing…";
    setTimeout(function () {
      var p = myp5;
      p.randomSeed(seed);
      var margin = CANVAS_SIZE * 0.03;
      sites = [];
      for (var i = 0; i < params.cellCount; i++) {
        sites.push({
          x: p.random(margin, CANVAS_SIZE - margin),
          y: p.random(margin, CANVAS_SIZE - margin),
          t: p.random(1),
        });
      }
      computeOwnership();
      for (var r = 0; r < params.relaxSteps; r++) {
        relaxSites(p);
        computeOwnership();
      }
      render(p);
      statusEl.textContent = "";
    }, 10);
  }

  var sketch = function (p) {
    p.setup = function () {
      var c = p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      c.parent(container);
      p.pixelDensity(1);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      p.noLoop();
      fullRebuild(parseInt(seedInput.value, 10) || 0);
    };
  };

  ArtCommon.setupSeedControls({
    seedInput: seedInput,
    shuffleBtn: shuffleBtn,
    regenerateBtn: regenerateBtn,
    onRegenerate: fullRebuild,
  });

  [cellsRange, relaxRange, resolutionRange].forEach(function (el) {
    el.addEventListener("change", function () {
      fullRebuild(parseInt(seedInput.value, 10) || 0);
    });
  });

  [borderRange, hueRange, spreadRange].forEach(function (el) {
    el.addEventListener("input", function () {
      readParams();
      if (myp5 && owner) render(myp5);
    });
  });

  downloadBtn.addEventListener("click", function () {
    var canvas = container.querySelector("canvas");
    ArtCommon.downloadCanvas(canvas, "voronoi-cells-seed" + seedInput.value + ".png");
  });

  myp5 = new p5(sketch);
})();
