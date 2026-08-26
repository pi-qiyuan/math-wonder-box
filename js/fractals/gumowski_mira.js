(function registerGumowskiMiraAttractor(global) {
  const PRESETS = [
    { alpha: 0.008, mu: -0.31, sigma: 0.05, nameKey: "gumowski_mira_preset_star"      },
    { alpha: 0.008, mu: -0.79, sigma: 0.05, nameKey: "gumowski_mira_preset_wings"     },
    { alpha: 0.009, mu: -0.90, sigma: 0.05, nameKey: "gumowski_mira_preset_vortex"    },
    { alpha: 0.008, mu: 0.34,  sigma: 0.05, nameKey: "gumowski_mira_preset_nautilus"  },
    { alpha: 0.008, mu: -0.416,sigma: 0.05, nameKey: "gumowski_mira_preset_ring"      },
    { alpha: 0.010, mu: -0.85, sigma: 0.05, nameKey: "gumowski_mira_preset_butterfly" },
    { alpha: 0.008, mu: -0.42, sigma: 0.05, nameKey: "gumowski_mira_preset_lattice"   },
    { alpha: 0.008, mu: -0.175,sigma: 0.05, nameKey: "gumowski_mira_preset_flower"    },
    { alpha: 0.008, mu: 0.056, sigma: 0.05, nameKey: "gumowski_mira_preset_mitosis"   },
    { alpha: 0.008, mu: -0.65, sigma: 0.05, nameKey: "gumowski_mira_preset_glider"    },
    { alpha: 0.008, mu: 0.320, sigma: 0.05, nameKey: "gumowski_mira_preset_orbit"     },
    { alpha: 0.008, mu: -0.80, sigma: 0.05, nameKey: "gumowski_mira_preset_solar"     }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let baseParams = { ...PRESETS[currentPresetIndex] };

  function f(x, mu) {
    return mu * x + (2 * (1 - mu) * x * x) / (1 + x * x);
  }

  function calculateOptimalView(canvas, params) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let tx = 0.1, ty = 0.1;
    const alpha = parseFloat(params.alpha);
    const mu = parseFloat(params.mu);
    const sigma = parseFloat(params.sigma);

    for (let i = 0; i < 50000; i++) {
      const fx = f(tx, mu);
      const nx = ty + alpha * (1 - sigma * ty * ty) * ty + fx;
      const fnx = f(nx, mu);
      const ny = -tx + fnx;
      tx = nx;
      ty = ny;

      if (!isFinite(tx) || !isFinite(ty) || Math.abs(tx) > 1e4 || Math.abs(ty) > 1e4) {
        break;
      }

      if (i > 1000) {
        if (tx < minX) minX = tx;
        if (tx > maxX) maxX = tx;
        if (ty < minY) minY = ty;
        if (ty > maxY) maxY = ty;
      }
    }

    if (!isFinite(minX) || minX >= maxX) {
      minX = -15; maxX = 15; minY = -15; maxY = 15;
    }

    const patternWidth = maxX - minX;
    const patternHeight = maxY - minY;
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const scale = Math.max(patternWidth / aspect, patternHeight) * 1.15 / 0.6;

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      scale: Math.max(scale, 0.1)
    };
  }

  let animationId = null;
  let currentX = 0.1;
  let currentY = 0.1;
  let time = 0;

  // --- Periodic-orbit escape hatch ---
  // Some (alpha, mu, sigma) combinations sit right next to a narrow periodic
  // window: the trajectory looks chaotic for a while but, after enough
  // iterations, drifts into the basin of a low-period sink and collapses
  // into a handful of repeating points. Rather than trying to hand-pick
  // parameters that are provably safe forever (not really possible for this
  // family of maps), we nudge the orbit by an imperceptibly small random
  // amount every ESCAPE_INTERVAL iterations. This is enough to kick the
  // trajectory out of a periodic sink's basin while being far too small to
  // see on screen, so healthy chaotic presets are unaffected.
  const ESCAPE_INTERVAL = 200000;
  const ESCAPE_MAGNITUDE = 1e-4;
  let iterationCount = 0;

  function maybeEscapePeriodicOrbit() {
    iterationCount++;
    if (iterationCount % ESCAPE_INTERVAL === 0) {
      currentX += (Math.random() - 0.5) * ESCAPE_MAGNITUDE;
      currentY += (Math.random() - 0.5) * ESCAPE_MAGNITUDE;
    }
  }

  // Quick synchronous check: does this (alpha, mu, sigma) combination collapse
  // into a short repeating cycle (or diverge)? Some combinations only reveal
  // their collapse after tens of thousands of extra iterations (the same
  // point can look perfectly chaotic after a short warmup and turn out to sit
  // right on a periodic sink once you warm up further), so we sample several
  // checkpoints up to the same 250,000-iteration warmup draw() actually uses,
  // instead of just checking once. Still cheap — plain arithmetic, no canvas
  // work — so it stays effectively instant even run several times in a row.
  const DEGENERACY_CHECKPOINTS = [6000, 20000, 60000, 150000, 250000];
  function isDegenerate(alpha, mu, sigma) {
    let x = 0.1, y = 0.1;
    let checkpointIdx = 0;
    const maxIterations = DEGENERACY_CHECKPOINTS[DEGENERACY_CHECKPOINTS.length - 1];

    for (let i = 0; i < maxIterations; i++) {
      const fx = f(x, mu);
      const nx = y + alpha * (1 - sigma * y * y) * y + fx;
      const fnx = f(nx, mu);
      const ny = -x + fnx;
      x = nx; y = ny;

      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e4 || Math.abs(y) > 1e4) {
        return true;
      }

      if (i + 1 === DEGENERACY_CHECKPOINTS[checkpointIdx]) {
        const startX = x, startY = y;
        let px = x, py = y;
        for (let p = 1; p <= 400; p++) {
          const fx2 = f(px, mu);
          const nx2 = py + alpha * (1 - sigma * py * py) * py + fx2;
          const fnx2 = f(nx2, mu);
          const ny2 = -px + fnx2;
          px = nx2; py = ny2;
          if (!isFinite(px) || !isFinite(py)) {
            return true;
          }
          if (Math.abs(px - startX) < 1e-8 && Math.abs(py - startY) < 1e-8) {
            return true;
          }
        }
        checkpointIdx++;
      }
    }
    return false;
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];

    let alpha, mu;
    const MAX_ATTEMPTS = 12;
    let attempt = 0;
    do {
      alpha = preset.alpha + (Math.random() - 0.5) * 0.001;
      mu = preset.mu + (Math.random() - 0.5) * 0.01;
      attempt++;
    } while (isDegenerate(alpha, mu, preset.sigma) && attempt < MAX_ATTEMPTS);

    // If every jittered attempt landed in a periodic window, fall back to the
    // preset's exact (known-good) values rather than risk shipping a dead one.
    if (isDegenerate(alpha, mu, preset.sigma)) {
      alpha = preset.alpha;
      mu = preset.mu;
    }

    baseParams = {
      alpha: alpha.toFixed(4),
      mu: mu.toFixed(4),
      sigma: preset.sigma
    };

    currentX = 0.1;
    currentY = 0.1;
    iterationCount = 0;

    return calculateOptimalView(canvas, baseParams);
  }

  function fitCanvasToDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = global.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(320, Math.floor(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    // 1. Fading background for smooth motion trail
    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.02)" : "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(0, 0, width, height);

    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // 2. Micro parameter dynamics
    time += 0.005;
    const alpha = parseFloat(baseParams.alpha) + Math.sin(time * 0.2) * 0.0001;
    const mu = parseFloat(baseParams.mu) + Math.cos(time * 0.3) * 0.0002;
    const sigma = parseFloat(baseParams.sigma);

    // 3. Dynamic color shift
    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.6)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.6)`;
    }

    const batchSize = 10000;
    for (let i = 0; i < batchSize; i++) {
      const fx = f(currentX, mu);
      const nx = currentY + alpha * (1 - sigma * currentY * currentY) * currentY + fx;
      const fnx = f(nx, mu);
      const ny = -currentX + fnx;

      currentX = nx;
      currentY = ny;

      if (!isFinite(currentX) || !isFinite(currentY) || Math.abs(currentX) > 1e4 || Math.abs(currentY) > 1e4) {
        currentX = 0.1;
        currentY = 0.1;
        iterationCount = 0;
      }

      maybeEscapePeriodicOrbit();

      const px = (currentX - view.centerX) / scaleX * width + width / 2;
      const py = (currentY - view.centerY) / scaleY * height + height / 2;

      if (px >= 0 && px < width && py >= 0 && py < height) {
        ctx.fillRect(px, py, 1, 1);
      }
    }

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();

    const resized = fitCanvasToDisplay(canvas);
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;
    const alpha = parseFloat(baseParams.alpha);
    const mu = parseFloat(baseParams.mu);
    const sigma = parseFloat(baseParams.sigma);

    let x = currentX, y = currentY;

    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.5)`;
    }

    const initialIterations = subsampling > 1 ? 50000 : 250000;
    for (let i = 0; i < initialIterations; i++) {
      const fx = f(x, mu);
      const nx = y + alpha * (1 - sigma * y * y) * y + fx;
      const fnx = f(nx, mu);
      const ny = -x + fnx;
      x = nx; y = ny;

      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e4 || Math.abs(y) > 1e4) {
        x = 0.1; y = 0.1;
        iterationCount = 0;
      }

      iterationCount++;
      if (iterationCount % ESCAPE_INTERVAL === 0) {
        x += (Math.random() - 0.5) * ESCAPE_MAGNITUDE;
        y += (Math.random() - 0.5) * ESCAPE_MAGNITUDE;
      }

      if (i > 500) {
        const px = (x - view.centerX) / scaleX * width + width / 2;
        const py = (y - view.centerY) / scaleY * height + height / 2;
        if (px >= 0 && px < width && py >= 0 && py < height) {
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    currentX = x;
    currentY = y;

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    }
  }

  function reset() {
    time = 0;
    currentX = 0.1;
    currentY = 0.1;
    iterationCount = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    GumowskiMira: {
      id: "GumowskiMira",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas"), baseParams); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "xₙ₊₁ = yₙ + α(1 - σyₙ²)yₙ + f(xₙ), yₙ₊₁ = -xₙ + f(xₙ₊₁)",
      //explanationUrl: "explanations/gumowski_mira.html",
    },
  };
})(window);
