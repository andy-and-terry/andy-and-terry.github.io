/* Flow Field: particles advected by a Perlin-noise vector field, trailing translucent strokes. */
(function () {
  var CANVAS_SIZE = 900;
  var container = document.getElementById("canvas-container");

  var seedInput = document.getElementById("seed-input");
  var shuffleBtn = document.getElementById("shuffle-seed-btn");
  var regenerateBtn = document.getElementById("regenerate-btn");
  var downloadBtn = document.getElementById("download-btn");

  var countRange = document.getElementById("count-range");
  var scaleRange = document.getElementById("scale-range");
  var turbulenceRange = document.getElementById("turbulence-range");
  var speedRange = document.getElementById("speed-range");
  var fadeRange = document.getElementById("fade-range");
  var hueRange = document.getElementById("hue-range");

  ArtCommon.bindRangeLabel(countRange, document.getElementById("count-value"));
  ArtCommon.bindRangeLabel(scaleRange, document.getElementById("scale-value"), function (v) {
    return parseFloat(v).toFixed(4);
  });
  ArtCommon.bindRangeLabel(turbulenceRange, document.getElementById("turbulence-value"), function (v) {
    return parseFloat(v).toFixed(1);
  });
  ArtCommon.bindRangeLabel(speedRange, document.getElementById("speed-value"), function (v) {
    return parseFloat(v).toFixed(1);
  });
  ArtCommon.bindRangeLabel(fadeRange, document.getElementById("fade-value"));
  ArtCommon.bindRangeLabel(hueRange, document.getElementById("hue-value"), function (v) {
    return v + "°";
  });

  var params = {};
  function readParams() {
    params.count = parseInt(countRange.value, 10);
    params.noiseScale = parseFloat(scaleRange.value);
    params.turbulence = parseFloat(turbulenceRange.value);
    params.speed = parseFloat(speedRange.value);
    params.fade = parseInt(fadeRange.value, 10);
    params.hue = parseInt(hueRange.value, 10);
  }

  var particles = [];
  var myp5 = null;

  function reset(seed) {
    readParams();
    if (!myp5) return;
    myp5.randomSeed(seed);
    myp5.noiseSeed(seed);
    particles = [];
    for (var i = 0; i < params.count; i++) {
      particles.push({
        x: myp5.random(myp5.width),
        y: myp5.random(myp5.height),
        hueOffset: myp5.random(70),
      });
    }
    myp5.background(params.hue, 20, 6);
  }

  var sketch = function (p) {
    p.setup = function () {
      var c = p.createCanvas(CANVAS_SIZE, CANVAS_SIZE);
      c.parent(container);
      p.pixelDensity(1);
      p.colorMode(p.HSB, 360, 100, 100, 100);
      reset(parseInt(seedInput.value, 10) || 0);
    };

    p.draw = function () {
      p.noStroke();
      p.fill(params.hue, 20, 6, params.fade / 4);
      p.rect(0, 0, p.width, p.height);

      for (var i = 0; i < particles.length; i++) {
        var particle = particles[i];
        var angle =
          p.noise(particle.x * params.noiseScale, particle.y * params.noiseScale) *
          p.TWO_PI *
          params.turbulence;
        var vx = p.cos(angle) * params.speed;
        var vy = p.sin(angle) * params.speed;
        var hue = (params.hue + particle.hueOffset + p.degrees(angle) * 0.15) % 360;

        p.stroke(hue, 70, 95, 65);
        p.strokeWeight(1.2);
        p.line(particle.x, particle.y, particle.x + vx, particle.y + vy);

        particle.x += vx;
        particle.y += vy;
        if (particle.x < 0) particle.x += p.width;
        if (particle.x > p.width) particle.x -= p.width;
        if (particle.y < 0) particle.y += p.height;
        if (particle.y > p.height) particle.y -= p.height;
      }
    };
  };

  ArtCommon.setupSeedControls({
    seedInput: seedInput,
    shuffleBtn: shuffleBtn,
    regenerateBtn: regenerateBtn,
    onRegenerate: reset,
  });

  [countRange, scaleRange, turbulenceRange, speedRange, fadeRange, hueRange].forEach(function (el) {
    el.addEventListener("input", function () {
      reset(parseInt(seedInput.value, 10) || 0);
    });
  });

  downloadBtn.addEventListener("click", function () {
    var canvas = container.querySelector("canvas");
    ArtCommon.downloadCanvas(canvas, "flow-field-seed" + seedInput.value + ".png");
  });

  myp5 = new p5(sketch);
})();
