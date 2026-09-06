/* Particle Orbits: particles orbiting a small system of gravity wells (attractors). */
(function () {
  var CANVAS_SIZE = 900;
  var container = document.getElementById("canvas-container");

  var seedInput = document.getElementById("seed-input");
  var shuffleBtn = document.getElementById("shuffle-seed-btn");
  var regenerateBtn = document.getElementById("regenerate-btn");
  var downloadBtn = document.getElementById("download-btn");

  var countRange = document.getElementById("count-range");
  var attractorsRange = document.getElementById("attractors-range");
  var gravityRange = document.getElementById("gravity-range");
  var orbitSpeedRange = document.getElementById("orbitspeed-range");
  var fadeRange = document.getElementById("fade-range");
  var hueRange = document.getElementById("hue-range");

  ArtCommon.bindRangeLabel(countRange, document.getElementById("count-value"));
  ArtCommon.bindRangeLabel(attractorsRange, document.getElementById("attractors-value"));
  ArtCommon.bindRangeLabel(gravityRange, document.getElementById("gravity-value"), function (v) {
    return parseFloat(v).toFixed(1);
  });
  ArtCommon.bindRangeLabel(orbitSpeedRange, document.getElementById("orbitspeed-value"), function (v) {
    return parseFloat(v).toFixed(1);
  });
  ArtCommon.bindRangeLabel(fadeRange, document.getElementById("fade-value"));
  ArtCommon.bindRangeLabel(hueRange, document.getElementById("hue-value"), function (v) {
    return v + "°";
  });

  var params = {};
  function readParams() {
    params.count = parseInt(countRange.value, 10);
    params.attractorCount = parseInt(attractorsRange.value, 10);
    params.gravity = parseFloat(gravityRange.value);
    params.orbitSpeed = parseFloat(orbitSpeedRange.value);
    params.fade = parseInt(fadeRange.value, 10);
    params.hue = parseInt(hueRange.value, 10);
  }

  var MIN_DIST = 24;
  var G = 1400;
  var ESCAPE_RADIUS = CANVAS_SIZE * 0.9;

  var attractors = [];
  var particles = [];
  var myp5 = null;

  function spawnParticle(p, index) {
    var margin = CANVAS_SIZE * 0.12;
    var attractor = attractors[index % attractors.length];
    var x = p.random(margin, CANVAS_SIZE - margin);
    var y = p.random(margin, CANVAS_SIZE - margin);
    var dx = attractor.x - x;
    var dy = attractor.y - y;
    var dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DIST);
    var speed = params.orbitSpeed * Math.sqrt((G * attractor.strength) / dist);
    var perpX = -dy / dist;
    var perpY = dx / dist;
    return {
      x: x,
      y: y,
      vx: perpX * speed,
      vy: perpY * speed,
      hue: attractor.hue,
      skipDraw: true,
    };
  }

  function reset(seed) {
    readParams();
    if (!myp5) return;
    var p = myp5;
    p.randomSeed(seed);
    p.noiseSeed(seed);

    var margin = CANVAS_SIZE * 0.2;
    attractors = [];
    for (var a = 0; a < params.attractorCount; a++) {
      attractors.push({
        x: p.random(margin, CANVAS_SIZE - margin),
        y: p.random(margin, CANVAS_SIZE - margin),
        strength: p.random(0.6, 1.4),
        hue: (params.hue + (360 / params.attractorCount) * a) % 360,
      });
    }

    particles = [];
    for (var i = 0; i < params.count; i++) {
      particles.push(spawnParticle(p, i));
    }

    p.background(params.hue, 25, 6);
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
      p.fill(params.hue, 25, 6, params.fade / 4);
      p.rect(0, 0, p.width, p.height);

      var center = CANVAS_SIZE / 2;
      for (var i = 0; i < particles.length; i++) {
        var particle = particles[i];
        var ax = 0;
        var ay = 0;
        for (var a = 0; a < attractors.length; a++) {
          var att = attractors[a];
          var dx = att.x - particle.x;
          var dy = att.y - particle.y;
          var dist2 = Math.max(dx * dx + dy * dy, MIN_DIST * MIN_DIST);
          var invDist = 1 / Math.sqrt(dist2);
          var force = (params.gravity * G * att.strength) / dist2;
          ax += force * dx * invDist;
          ay += force * dy * invDist;
        }

        var prevX = particle.x;
        var prevY = particle.y;
        particle.vx += ax;
        particle.vy += ay;
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (!particle.skipDraw) {
          p.stroke(particle.hue, 65, 95, 70);
          p.strokeWeight(1.4);
          p.line(prevX, prevY, particle.x, particle.y);
        }
        particle.skipDraw = false;

        var distFromCenter = Math.hypot(particle.x - center, particle.y - center);
        if (distFromCenter > ESCAPE_RADIUS) {
          particles[i] = spawnParticle(p, i);
        }
      }

      p.noStroke();
      for (var b = 0; b < attractors.length; b++) {
        var at = attractors[b];
        p.fill(at.hue, 40, 100, 90);
        p.circle(at.x, at.y, 6);
        p.fill(at.hue, 40, 100, 25);
        p.circle(at.x, at.y, 18);
      }
    };
  };

  ArtCommon.setupSeedControls({
    seedInput: seedInput,
    shuffleBtn: shuffleBtn,
    regenerateBtn: regenerateBtn,
    onRegenerate: reset,
  });

  [countRange, attractorsRange, gravityRange, orbitSpeedRange, fadeRange, hueRange].forEach(function (el) {
    el.addEventListener("input", function () {
      reset(parseInt(seedInput.value, 10) || 0);
    });
  });

  downloadBtn.addEventListener("click", function () {
    var canvas = container.querySelector("canvas");
    ArtCommon.downloadCanvas(canvas, "particle-orbits-seed" + seedInput.value + ".png");
  });

  myp5 = new p5(sketch);
})();
