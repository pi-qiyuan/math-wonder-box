(function registerGumowskiMiraAttractor(global) {
  const PRESETS = [
    { alpha: 0.008, mu: -0.31, sigma: 0.05, nameKey: "gumowski_mira_preset_star"      },
    { alpha: 0.008, mu: -0.75, sigma: 0.05, nameKey: "gumowski_mira_preset_wings"     },
    { alpha: 0.009, mu: -0.90, sigma: 0.05, nameKey: "gumowski_mira_preset_vortex"    },
    { alpha: 0.008, mu: 0.34,  sigma: 0.05, nameKey: "gumowski_mira_preset_nautilus"  },
    { alpha: 0.008, mu: -0.50, sigma: 0.05, nameKey: "gumowski_mira_preset_ring"      },
    { alpha: 0.010, mu: -0.85, sigma: 0.05, nameKey: "gumowski_mira_preset_butterfly" },
    { alpha: 0.008, mu: -0.42, sigma: 0.05, nameKey: "gumowski_mira_preset_lattice"   },
    { alpha: 0.008, mu: -0.20, sigma: 0.05, nameKey: "gumowski_mira_preset_flower"    },
    { alpha: 0.008, mu: 0.00,  sigma: 0.05, nameKey: "gumowski_mira_preset_mitosis"   },
    { alpha: 0.008, mu: -0.65, sigma: 0.05, nameKey: "gumowski_mira_preset_glider"    },
    { alpha: 0.008, mu: 0.20,  sigma: 0.05, nameKey: "gumowski_mira_preset_orbit"     },
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

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];

    baseParams = {
      alpha: (preset.alpha + (Math.random() - 0.5) * 0.001).toFixed(4),
      mu: (preset.mu + (Math.random() - 0.5) * 0.01).toFixed(4),
      sigma: preset.sigma
    };

    currentX = 0.1;
    currentY = 0.1;

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
      }

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
