/* Shared helpers for the generative art tools: seed controls, range-label binding, PNG export. */
var ArtCommon = (function () {
  function randomSeed32() {
    return Math.floor(Math.random() * 4294967295);
  }

  function clampSeed(value) {
    var n = Math.floor(Number(value));
    if (!isFinite(n) || n < 0) n = 0;
    return n;
  }

  /**
   * Wires up a seed number input, a shuffle ("random seed") button, and a
   * regenerate button so all three call back into onRegenerate(seed).
   */
  function setupSeedControls(opts) {
    var seedInput = opts.seedInput;
    var shuffleBtn = opts.shuffleBtn;
    var regenerateBtn = opts.regenerateBtn;

    function commit(seed) {
      seed = clampSeed(seed);
      seedInput.value = seed;
      opts.onRegenerate(seed);
    }

    shuffleBtn.addEventListener("click", function () {
      commit(randomSeed32());
    });
    regenerateBtn.addEventListener("click", function () {
      commit(seedInput.value);
    });
    seedInput.addEventListener("change", function () {
      commit(seedInput.value);
    });
  }

  /** Binds an <input type=range> to a label element, formatting its value on every input event. */
  function bindRangeLabel(rangeEl, labelEl, formatter) {
    function update() {
      labelEl.textContent = formatter ? formatter(rangeEl.value) : rangeEl.value;
    }
    rangeEl.addEventListener("input", update);
    update();
  }

  function downloadCanvas(canvas, filename) {
    if (!canvas) return;
    var link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return {
    randomSeed32: randomSeed32,
    setupSeedControls: setupSeedControls,
    bindRangeLabel: bindRangeLabel,
    downloadCanvas: downloadCanvas,
  };
})();
