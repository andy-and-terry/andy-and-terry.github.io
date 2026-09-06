/* Wave Interference: circular waves from several point sources, summed into an animated interference field. */
(function () {
  var CANVAS_SIZE = 900;
  var container = document.getElementById("canvas-container");

  var seedInput = document.getElementById("seed-input");
  var shuffleBtn = document.getElementById("shuffle-seed-btn");
  var regenerateBtn = document.getElementById("regenerate-btn");
  var downloadBtn = document.getElementById("download-btn");

  var sourcesRange = document.getElementById("sources-range");
  var wavelengthRange = document.getElementById("wavelength-range");
  var speedRange = document.getElementById("speed-range");
  var hueRange = document.getElementById("hue-range");
  var huemodRange = document.getElementById("huemod-range");
  var resolutionRange = document.getElementById("resolution-range");

  ArtCommon.bindRangeLabel(sourcesRange, document.getElementById("sources-value"));
  ArtCommon.bindRangeLabel(wavelengthRange, document.getElementById("wavelength-value"));
  ArtCommon.bindRangeLabel(speedRange, document.getElementById("speed-value"), function (v) {
    return parseFloat(v).toFixed(1);
  });
  ArtCommon.bindRangeLabel(hueRange, document.getElementById("hue-value"), function (v) {
    return v + "°";
  });
  ArtCommon.bindRangeLabel(huemodRange, document.getElementById("huemod-value"), function (v) {
    return v + "°";
  });
  ArtCommon.bindRangeLabel(resolutionRange, document.getElementById("resolution-value"));

  var params = {};
  function readParams() {
    params.sourceCount = parseInt(sourcesRange.value, 10);
    params.wavelength = parseFloat(wavelengthRange.value);
    params.waveSpeed = parseFloat(speedRange.value);
    params.hue = parseInt(hueRange.value, 10);
    params.hueMod = parseInt(huemodRange.value, 10);
    params.resolution = parseInt(resolutionRange.value, 10);
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    v /= 100;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r1, g1, b1;
    if (h < 60) {
      r1 = c; g1 = x; b1 = 0;
    } else if (h < 120) {
      r1 = x; g1 = c; b1 = 0;
    } else if (h < 180) {
      r1 = 0; g1 = c; b1 = x;
    } else if (h < 240) {
      r1 = 0; g1 = x; b1 = c;
    } else if (h < 300) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }
    return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
  }

  var sources = [];
  var buffer = null;
  var time = 0;
  var myp5 = null;

  function rebuild(seed) {
    readParams();
    if (!myp5) return;
    var p = myp5;
    buffer = p.createGraphics(params.resolution, params.resolution);
    buffer.pixelDensity(1);

    p.randomSeed(seed);
    sources = [];
    var margin = params.resolution * 0.15;
    for (var i = 0; i < params.sourceCount; i++) {
      sources.push({
        x: p.random(margin, params.resolution - margin),
        y: p.random(margin, params.resolution - margin),
        phase: p.random(p.TWO_PI),
      });
    }
    time = 0;
  }

  var sketch = function (p) {
    p.setup = function () {
      var c = p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      c.parent(container);
      p.pixelDensity(1);
      rebuild(parseInt(seedInput.value, 10) || 0);
    };

    p.draw = function () {
      readParams();
      if (!buffer) return;
      var R = params.resolution;
      var freqScale = (CANVAS_SIZE / R) * ((2 * Math.PI) / params.wavelength);
      var n = sources.length;

      buffer.loadPixels();
      for (var y = 0; y < R; y++) {
        for (var x = 0; x < R; x++) {
          var sum = 0;
          for (var i = 0; i < n; i++) {
            var dx = x - sources[i].x;
            var dy = y - sources[i].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            sum += Math.sin(dist * freqScale - time + sources[i].phase);
          }
          sum /= n;

          var bri = 12 + (sum * 0.5 + 0.5) * 80;
          var hue = params.hue + sum * params.hueMod;
          var rgb = hsvToRgb(hue, 60, bri);
          var idx = (x + y * R) * 4;
          buffer.pixels[idx] = rgb[0];
          buffer.pixels[idx + 1] = rgb[1];
          buffer.pixels[idx + 2] = rgb[2];
          buffer.pixels[idx + 3] = 255;
        }
      }
      buffer.updatePixels();
      p.image(buffer, 0, 0, p.width, p.height);

      time += params.waveSpeed * 0.12;
    };
  };

  ArtCommon.setupSeedControls({
    seedInput: seedInput,
    shuffleBtn: shuffleBtn,
    regenerateBtn: regenerateBtn,
    onRegenerate: rebuild,
  });

  [sourcesRange, resolutionRange].forEach(function (el) {
    el.addEventListener("input", function () {
      rebuild(parseInt(seedInput.value, 10) || 0);
    });
  });

  downloadBtn.addEventListener("click", function () {
    var canvas = container.querySelector("canvas");
    ArtCommon.downloadCanvas(canvas, "wave-interference-seed" + seedInput.value + ".png");
  });

  myp5 = new p5(sketch);
})();
