(function registerCliffordAttractor(global) {
  const PRESETS = [
    { a: -1.4, b: 1.6,  c: 1.0,  d: 0.7,  nameKey: "clifford_preset_feather"   },
    { a: 1.5,  b: -1.8, c: 1.6,  d: 0.9,  nameKey: "clifford_preset_spirals"   },
    { a: 1.7,  b: 1.7,  c: 0.6,  d: 1.2,  nameKey: "clifford_preset_galaxy"    },
    { a: -1.7, b: 1.3,  c: -0.1, d: -1.2, nameKey: "clifford_preset_woven"     },
    { a: -1.8, b: -1.9, c: -1.4, d: 1.1,  nameKey: "clifford_preset_spider"    },
    { a: 1.1,  b: 1.4,  c: 1.9,  d: -1.1, nameKey: "clifford_preset_orchid"    },
    { a: -1.2, b: -1.9, c: 0.5,  d: 1.5,  nameKey: "clifford_preset_butterfly" },
    { a: -1.4, b: 1.5,  c: 1.0,  d: 1.0,  nameKey: "clifford_preset_nebula"    },
    { a: 1.6,  b: -1.6, c: 0.9,  d: 0.9,  nameKey: "clifford_preset_vortex"    },
    { a: -1.7, b: 1.5,  c: -1.2, d: 1.3,  nameKey: "clifford_preset_flame"     },
    { a: -2.0, b: -2.0, c: -1.2, d: 2.0,  nameKey: "clifford_preset_infinity"  },
    { a: -1.7, b: 1.8,  c: -1.9, d: -0.4, nameKey: "clifford_preset_nautilus"  },
    { a: -1.3, b: -1.3, c: -1.0, d: -1.0, nameKey: "clifford_preset_quad"      },
    { a: -1.7, b: 1.8,  c: -1.9, d: 0.4,  nameKey: "clifford_preset_feathery"  },
    { a: -1.3, b: -1.3, c: -1.8, d: -1.9, nameKey: "clifford_preset_flower"    },
    { a: -1.4, b: 1.7,  c: 1.8,  d: -1.9, nameKey: "clifford_preset_wings"     },
    { a: -1.8, b: -2.0, c: 0.5,  d: 0.9,  nameKey: "clifford_preset_branch"    },
    { a: 1.6,  b: -1.6, c: -1.0, d: 1.0,  nameKey: "clifford_preset_cross"     }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let baseParams = { ...PRESETS[currentPresetIndex] };

  function calculateOptimalView(canvas, params) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let tx = 0.1, ty = 0.1;
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);
    const d = parseFloat(params.d);

    for (let i = 0; i < 50000; i++) {
      const nx = Math.sin(a * ty) + c * Math.cos(a * tx);
      const ny = Math.sin(b * tx) + d * Math.cos(b * ty);
      tx = nx; ty = ny;
      if (i > 1000) {
        if (tx < minX) minX = tx;
        if (tx > maxX) maxX = tx;
        if (ty < minY) minY = ty;
        if (ty > maxY) maxY = ty;
      }
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
      a: (preset.a + (Math.random() - 0.5) * 0.05).toFixed(3),
      b: (preset.b + (Math.random() - 0.5) * 0.05).toFixed(3),
      c: (preset.c + (Math.random() - 0.5) * 0.05).toFixed(3),
      d: (preset.d + (Math.random() - 0.5) * 0.05).toFixed(3)
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

    // 1. Theme-aware fading
    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.02)" : "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(0, 0, width, height);

    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // 2. Evolution of time and parameters
    time += 0.005;
    const a = parseFloat(baseParams.a) + Math.sin(time * 0.3) * 0.002;
    const b = parseFloat(baseParams.b) + Math.cos(time * 0.5) * 0.002;
    const c = parseFloat(baseParams.c) + Math.sin(time * 0.7) * 0.002;
    const d = parseFloat(baseParams.d) + Math.cos(time * 0.2) * 0.002;

    // 3. Dynamic Color calculation (HSL)
    // Speed: time * 20 rotates through colors every ~18 seconds
    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.6)`; // Glowing pastel
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.6)`; // Deep vibrant
    }
    
    const batchSize = 10000;
    for (let i = 0; i < batchSize; i++) {
      const nx = Math.sin(a * currentY) + c * Math.cos(a * currentX);
      const ny = Math.sin(b * currentX) + d * Math.cos(b * currentY);
      currentX = nx;
      currentY = ny;

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
    const { a, b, c, d } = baseParams;

    let x = currentX, y = currentY;
    
    // Use current time-based hue for the burst render as well
    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.5)`;
    }
    
    const initialIterations = subsampling > 1 ? 50000 : 250000;
    for (let i = 0; i < initialIterations; i++) {
      const nx = Math.sin(a * y) + c * Math.cos(a * x);
      const ny = Math.sin(b * x) + d * Math.cos(b * y);
      x = nx; y = ny;
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
    Clifford: {
      id: "Clifford",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas"), baseParams); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "xₙ₊₁ = sin(ayₙ) + c·cos(axₙ), yₙ₊₁ = sin(bxₙ) + d·cos(byₙ)",
      // explanationUrl: "explanations/clifford.html",
    },
  };
})(window);
