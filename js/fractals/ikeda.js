(function registerIkedaAttractor(global) {
  const PRESETS = [
    { u: 0.9,   c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_whirlpool"  },
    { u: 0.82,  c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_spiral"     },
    { u: 0.87,  c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_tempest"    },
    { u: 0.7,   c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_lantern"    },
    { u: 0.998, c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_maelstrom"  },
    { u: 0.68,  c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_pinwheel"   },
    { u: 0.84,  c1: 0.42, c2: 6.0, nameKey: "ikeda_preset_beacon"     },
    { u: 0.8,   c1: 0.4,  c2: 5.5, nameKey: "ikeda_preset_shell"      },
    { u: 0.9,   c1: 0.38, c2: 6.5, nameKey: "ikeda_preset_riptide"    },
    { u: 0.75,  c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_lotus"      },
    { u: 0.86,  c1: 0.4,  c2: 6.2, nameKey: "ikeda_preset_typhoon"    },
    { u: 0.71,  c1: 0.4,  c2: 6.0, nameKey: "ikeda_preset_gyre"       }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let baseParams = { ...PRESETS[currentPresetIndex] };

  function step(x, y, u, c1, c2) {
    const t = c1 - c2 / (1 + x * x + y * y);
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const nx = 1 + u * (x * cosT - y * sinT);
    const ny = u * (x * sinT + y * cosT);
    return [nx, ny];
  }

  function calculateOptimalView(canvas, params) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let tx = 0.1, ty = 0.1;
    const u = parseFloat(params.u);
    const c1 = parseFloat(params.c1);
    const c2 = parseFloat(params.c2);

    for (let i = 0; i < 50000; i++) {
      const [nx, ny] = step(tx, ty, u, c1, c2);
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
      minX = -3; maxX = 3; minY = -3; maxY = 3;
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
      u: (preset.u + (Math.random() - 0.5) * 0.01).toFixed(4),
      c1: (preset.c1 + (Math.random() - 0.5) * 0.01).toFixed(4),
      c2: (preset.c2 + (Math.random() - 0.5) * 0.05).toFixed(4)
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
    const u = parseFloat(baseParams.u) + Math.sin(time * 0.2) * 0.0015;
    const c1 = parseFloat(baseParams.c1) + Math.cos(time * 0.23) * 0.0015;
    const c2 = parseFloat(baseParams.c2) + Math.sin(time * 0.17) * 0.01;

    // 3. Dynamic color shift
    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.6)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.6)`;
    }

    const batchSize = 10000;
    for (let i = 0; i < batchSize; i++) {
      const [nx, ny] = step(currentX, currentY, u, c1, c2);
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
    const u = parseFloat(baseParams.u);
    const c1 = parseFloat(baseParams.c1);
    const c2 = parseFloat(baseParams.c2);

    let x = currentX, y = currentY;

    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.5)`;
    }

    const initialIterations = subsampling > 1 ? 50000 : 250000;
    for (let i = 0; i < initialIterations; i++) {
      const [nx, ny] = step(x, y, u, c1, c2);
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
    Ikeda: {
      id: "Ikeda",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas"), baseParams); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "tₙ = c₁ - c₂/(1 + xₙ² + yₙ²), xₙ₊₁ = 1 + u(xₙcos tₙ - yₙsin tₙ), yₙ₊₁ = u(xₙsin tₙ + yₙcos tₙ)",
      //explanationUrl: "explanations/ikeda.html",
    },
  };
})(window);
