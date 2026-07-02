(function registerChladniFigure(global) {
  const PRESETS = [
    {id: "classic_square",    nameKey: "chladni_preset_classic",   n: 3, m: 2, a: 1,   b: 1,   particles: 20000, formula: "cos(3πx)cos(2πy) + cos(2πx)cos(3πy) = 0"       },
    {id: "harmonic_mesh",     nameKey: "chladni_preset_harmonic",  n: 5, m: 4, a: 1,   b: -1,  particles: 25000, formula: "cos(5πx)cos(4πy) - cos(4πx)cos(5πy) = 0"       },
    {id: "complex_resonance", nameKey: "chladni_preset_resonance", n: 7, m: 2, a: 0.5, b: 1.5, particles: 30000, formula: "0.5cos(7πx)cos(2πy) + 1.5cos(2πx)cos(7πy) = 0" },
    {id: "star_vibration",    nameKey: "chladni_preset_star",      n: 6, m: 5, a: 1,   b: 0.2, particles: 22000, formula: "cos(6πx)cos(5πy) + 0.2cos(5πx)cos(6πy) = 0"    },
    {id: "deep_sea",          nameKey: "chladni_preset_deep_sea",  n: 8, m: 3, a: 1,   b: 1,   particles: 28000, formula: "cos(8πx)cos(3πy) + cos(3πx)cos(8πy) = 0"       }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let particles = [];

  // The particle field lives in a fixed coordinate domain, independent of
  // the camera (view.center/view.scale). Panning/zooming only changes
  // what part of this fixed field gets rendered — it never reshuffles or
  // discards existing particles. This is what keeps the settled nodal
  // pattern visually stable while panning/zooming (no flicker, no
  // "everything turns back into noise").
  let fieldCenterX = 0;
  let fieldCenterY = 0;
  let fieldScaleX = 2.2;
  let fieldScaleY = 2.2;
  const DEFAULT_SCALE = 2.2;
  // Particles per unit² at the default zoom level, used to figure out how
  // many particles a newly-visible (e.g. zoomed-in) region should have.
  let baseDensity = 0;
  // Safety cap so zooming in repeatedly can't grow the array forever.
  let maxParticles = 0;

  function initParticles(count, aspect) {
    particles = [];
    fieldCenterX = 0;
    fieldCenterY = 0;
    fieldScaleX = DEFAULT_SCALE * (aspect || 1);
    fieldScaleY = DEFAULT_SCALE;
    baseDensity = count / (fieldScaleX * fieldScaleY);
    maxParticles = count * 3;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: fieldCenterX + (Math.random() - 0.5) * fieldScaleX,
        y: fieldCenterY + (Math.random() - 0.5) * fieldScaleY
      });
    }
  }

  // When the user zooms into a small region of the field, the handful of
  // particles that happen to fall in that region may be too sparse to see
  // anything. Top up the density inside the visible bounds by adding new
  // particles there — existing particles elsewhere are left untouched, so
  // parts of the pattern that have already settled stay stable and don't
  // flicker back into noise.
  function ensureDensity(view, aspect) {
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;
    if (!Number.isFinite(scaleX) || scaleX <= 0 || !Number.isFinite(scaleY) || scaleY <= 0) return;

    const minX = view.centerX - scaleX / 2;
    const maxX = view.centerX + scaleX / 2;
    const minY = view.centerY - scaleY / 2;
    const maxY = view.centerY + scaleY / 2;

    let visibleCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) visibleCount++;
    }

    const visibleArea = scaleX * scaleY;
    const desiredCount = Math.min(baseDensity * visibleArea, maxParticles);
    const toAdd = Math.ceil(desiredCount - visibleCount);

    if (toAdd > 0 && particles.length < maxParticles) {
      const actualToAdd = Math.min(toAdd, maxParticles - particles.length);
      for (let i = 0; i < actualToAdd; i++) {
        particles.push({
          x: view.centerX + (Math.random() - 0.5) * scaleX,
          y: view.centerY + (Math.random() - 0.5) * scaleY
        });
      }
    }
  }

  function getVibration(x, y, n, m, a, b) {
    return a * Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y) +
           b * Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y);
  }

  function cleanup() {
    particles = [];
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    const aspect = canvas.width / canvas.height;
    initParticles(preset.particles, aspect);

    // Initial settling
    const defaultView = { centerX: 0, centerY: 0, scale: DEFAULT_SCALE };
    for (let iter = 0; iter < 10; iter++) {
      updateParticles(preset, defaultView, aspect);
    }

    return defaultView;
  }

  function updateParticles(preset, view, aspect) {
    const { n, m, a, b } = preset;
    const step = 0.03 * (view.scale / DEFAULT_SCALE);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Safety net: if a particle's coordinates ever became invalid
      // (NaN/Infinity) for any reason, respawn it inside the field
      // domain instead of leaving it permanently broken.
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        p.x = fieldCenterX + (Math.random() - 0.5) * fieldScaleX;
        p.y = fieldCenterY + (Math.random() - 0.5) * fieldScaleY;
      }

      // Wrap-around within the fixed field domain (not the current
      // camera view). This keeps the particle distribution stable no
      // matter how the user pans/zooms — the camera only changes what
      // portion of the field is rendered, never the field itself.
      const minX = fieldCenterX - fieldScaleX / 2;
      const minY = fieldCenterY - fieldScaleY / 2;
      p.x = ((p.x - minX) % fieldScaleX + fieldScaleX) % fieldScaleX + minX;
      p.y = ((p.y - minY) % fieldScaleY + fieldScaleY) % fieldScaleY + minY;

      // Random walk towards nodal lines
      const currentV = Math.abs(getVibration(p.x, p.y, n, m, a, b));
      const nx = p.x + (Math.random() * step * 2 - step);
      const ny = p.y + (Math.random() * step * 2 - step);

      const nextV = Math.abs(getVibration(nx, ny, n, m, a, b));
      if (nextV < currentV) {
        p.x = nx;
        p.y = ny;
      }
    }
  }

  function draw(canvas, view, subsampling = 1) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    if (particles.length === 0) initParticles(preset.particles, aspect);

    // Top up density in the currently visible region before updating, so
    // a deep zoom-in always has something to render instead of looking
    // empty just because few of the existing particles happen to land
    // there.
    ensureDensity(view, aspect);

    updateParticles(preset, view, aspect);

    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    ctx.fillStyle = isDark ? "rgba(200, 220, 255, 0.6)" : "rgba(40, 60, 100, 0.6)";
    const size = (width / 450) * (subsampling === 1 ? 1 : 1.5);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const px = (p.x - view.centerX) / scaleX * width + width / 2;
      const py = (p.y - view.centerY) / scaleY * height + height / 2;

      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        ctx.fillRect(px, py, size, size);
      }
    }
  }

  function reset() {
    particles = []; // Will be re-init in draw
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    ChladniFigure: {
      id: "ChladniFigure",
      get defaultView() { return { centerX: 0, centerY: 0, scale: 2.2 }; },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      // get formula() { return PRESETS[currentPresetIndex].formula; },
      // explanationUrl: "explanations/chladni_figure.html",
    },
  };
})(window);
