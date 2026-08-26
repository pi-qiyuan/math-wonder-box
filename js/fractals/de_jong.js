(function registerDeJongAttractor(global) {
  const PRESETS = [
    { a: -2.0,   b: -2.0,   c: -1.2,   d: 2.0,   nameKey: "de_jong_preset_nebula"       },
    { a: 1.4,    b: -2.3,   c: 2.4,    d: -2.1,  nameKey: "de_jong_preset_corridor"     },
    { a: -2.7,   b: -0.09,  c: -0.86,  d: -2.2,  nameKey: "de_jong_preset_ripple"       },
    { a: -0.827, b: -1.637, c: 1.659,  d: -0.943,nameKey: "de_jong_preset_web"          },
    { a: 1.4,    b: 1.56,   c: 1.4,    d: -6.56, nameKey: "de_jong_preset_garden"       },
    { a: -2.24,  b: 0.43,   c: -0.65,  d: -2.43, nameKey: "de_jong_preset_mist"         },
    { a: 2.01,   b: -2.53,  c: 1.61,   d: -0.33, nameKey: "de_jong_preset_aurora"       },
    { a: 1.5833, b: 1.6159, c: 0.2043, d: 1.344,  nameKey: "de_jong_preset_hourglass"   },
    { a: -2.5904,b: -0.1923,c: -0.9417,d: -1.0781,nameKey: "de_jong_preset_silk"        },
    { a: -1.244, b: -1.251, c: -1.815, d: -1.734,nameKey: "de_jong_preset_kaleidoscope" },
    { a: 1.641,  b: 1.902,  c: 0.316,  d: 1.525, nameKey: "de_jong_preset_stardust"     },
    { a: -2.0,   b: -0.5,   c: -0.9,   d: -2.7,  nameKey: "de_jong_preset_feather"      }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let baseParams = { ...PRESETS[currentPresetIndex] };

  function step(x, y, a, b, c, d) {
    const nx = Math.sin(a * y) - Math.cos(b * x);
    const ny = Math.sin(c * x) - Math.cos(d * y);
    return [nx, ny];
  }

  function calculateOptimalView(canvas, params) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let tx = 0.1, ty = 0.1;
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);
    const d = parseFloat(params.d);

    for (let i = 0; i < 50000; i++) {
      const [nx, ny] = step(tx, ty, a, b, c, d);
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
      a: (preset.a + (Math.random() - 0.5) * 0.05).toFixed(4),
      b: (preset.b + (Math.random() - 0.5) * 0.05).toFixed(4),
      c: (preset.c + (Math.random() - 0.5) * 0.05).toFixed(4),
      d: (preset.d + (Math.random() - 0.5) * 0.05).toFixed(4)
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
    const a = parseFloat(baseParams.a) + Math.sin(time * 0.2) * 0.002;
    const b = parseFloat(baseParams.b) + Math.cos(time * 0.23) * 0.002;
    const c = parseFloat(baseParams.c) + Math.sin(time * 0.17) * 0.002;
    const d = parseFloat(baseParams.d) + Math.cos(time * 0.3) * 0.002;

    // 3. Dynamic color shift
    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.6)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.6)`;
    }

    const batchSize = 10000;
    for (let i = 0; i < batchSize; i++) {
      const [nx, ny] = step(currentX, currentY, a, b, c, d);
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
    const a = parseFloat(baseParams.a);
    const b = parseFloat(baseParams.b);
    const c = parseFloat(baseParams.c);
    const d = parseFloat(baseParams.d);

    let x = currentX, y = currentY;

    const hue = (time * 15) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 85%, 35%, 0.5)`;
    }

    const initialIterations = subsampling > 1 ? 50000 : 250000;
    for (let i = 0; i < initialIterations; i++) {
      const [nx, ny] = step(x, y, a, b, c, d);
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
    DeJong: {
      id: "DeJong",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas"), baseParams); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "xₙ₊₁ = sin(a·yₙ) − cos(b·xₙ), yₙ₊₁ = sin(c·xₙ) − cos(d·yₙ)",
      explanationUrl: "/tools/math-wonder-box/de_jong.html",
    },
  };
})(window);
