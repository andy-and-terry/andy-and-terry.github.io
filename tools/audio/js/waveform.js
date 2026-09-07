/* Shared audio helpers: decode a file into an AudioBuffer and paint it as a waveform on canvas. */
window.AudioToolkit = (function () {
  "use strict";

  async function decodeAudioBuffer(file) {
    const arrayBuffer = await file.arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("Web Audio API not supported in this browser.");
    const ctx = new Ctx();
    try {
      return await ctx.decodeAudioData(arrayBuffer);
    } finally {
      ctx.close();
    }
  }

  // opts: { color, dimColor, selStart, selEnd } — selStart/selEnd (seconds) dim the trimmed-out range.
  function drawWaveform(canvas, audioBuffer, opts) {
    opts = opts || {};
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = canvas.clientHeight || 110;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const data = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration || 1;
    const step = Math.max(1, Math.floor(data.length / cssWidth));
    const amp = cssHeight / 2;
    const color = opts.color || "#7c8cff";
    const dimColor = opts.dimColor || "rgba(124, 140, 255, 0.18)";
    const hasSel = opts.selStart != null && opts.selEnd != null;

    for (let i = 0; i < cssWidth; i++) {
      let min = 0,
        max = 0;
      const start = i * step;
      const end = Math.min(start + step, data.length);
      for (let j = start; j < end; j++) {
        const v = data[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const t = (i / cssWidth) * duration;
      const inSel = hasSel ? t >= opts.selStart && t <= opts.selEnd : true;
      ctx.fillStyle = inSel ? color : dimColor;
      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;
      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }
  }

  // Toggles between a canvas and an empty/status message without ever replacing DOM nodes,
  // so callers can keep a stable reference to the canvas element.
  function setupWaveformBox(canvas, emptyEl) {
    function loading(text) {
      canvas.style.display = "none";
      emptyEl.style.display = "flex";
      emptyEl.textContent = text || "Loading waveform…";
    }
    function ready() {
      emptyEl.style.display = "none";
      canvas.style.display = "block";
    }
    function error(text) {
      canvas.style.display = "none";
      emptyEl.style.display = "flex";
      emptyEl.textContent = text || "Waveform preview unavailable — the rest of the tool still works.";
    }
    return { loading: loading, ready: ready, error: error };
  }

  function fmtBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(1);
    return m + ":" + (sec.length < 4 ? "0" + sec : sec);
  }

  return {
    decodeAudioBuffer: decodeAudioBuffer,
    drawWaveform: drawWaveform,
    setupWaveformBox: setupWaveformBox,
    fmtBytes: fmtBytes,
    fmtTime: fmtTime,
  };
})();
