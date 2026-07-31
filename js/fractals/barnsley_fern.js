(function registerBarnsleyFern(global) {
  const PRESETS = [
    {
      id: "classic",
      nameKey: "barnsley_preset_classic",
      view: { centerX: 0.23, centerY: 4.5, scale: 13 },
      transforms: [
        { a: 0,    b: 0,    c: 0,     d: 0.16, e: 0, f: 0,    p: 0.01 },
        { a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6,  p: 0.86 },
        { a: 0.2,  b: -0.26,c: 0.23,  d: 0.22, e: 0, f: 1.6,  p: 0.93 },
        { a: -0.15,b: 0.28, c: 0.26,  d: 0.24, e: 0, f: 0.44, p: 1.00 }
      ]
    },
    {
      id: "culcita",
      nameKey: "barnsley_preset_culcita",
      view: { centerX: 0, centerY: 2.5, scale: 8 },
      transforms: [
        { a: 0,    b: 0,    c: 0,     d: 0.25, e: 0, f: -0.14, p: 0.02 },
        { a: 0.85, b: 0.02, c: -0.02, d: 0.83, e: 0, f: 1.0,   p: 0.86 },
        { a: 0.09, b: -0.28,c: 0.3,   d: 0.11, e: 0, f: 0.6,   p: 0.93 },
        { a: -0.09,b: 0.28, c: 0.3,   d: 0.09, e: 0, f: 0.7,   p: 1.00 }
      ]
    },
    {
      id: "cyclosorus",
      nameKey: "barnsley_preset_cyclosorus",
      view: { centerX: 0, centerY: 3, scale: 10 },
      transforms: [
        { a: 0,     b: 0,     c: 0,      d: 0.25, e: 0,      f: -0.4,  p: 0.02 },
        { a: 0.95,  b: 0.005, c: -0.005, d: 0.93, e: -0.002, f: 0.5,   p: 0.86 },
        { a: 0.035, b: -0.2,  c: 0.16,   d: 0.04, e: -0.09,  f: 0.02,  p: 0.93 },
        { a: -0.04, b: 0.2,   c: 0.16,   d: 0.04, e: 0.083,  f: 0.12,  p: 1.00 }
      ]
    },
    {
      id: "fishbone",
      nameKey: "barnsley_preset_fishbone",
      view: { centerX: 0, centerY: 3, scale: 11 },
      transforms: [
        { a: 0,     b: 0,     c: 0,     d: 0.25, e: 0,      f: -0.4,  p: 0.02 },
        { a: 0.95,  b: 0.002, c: -0.002,d: 0.93, e: -0.002, f: 0.5,   p: 0.86 },
        { a: 0.035, b: -0.11, c: 0.27,  d: 0.01, e: -0.05,  f: 0.005, p: 0.93 },
        { a: -0.04, b: 0.11,  c: 0.27,  d: 0.01, e: 0.047,  f: 0.06,  p: 1.00 }
      ]
    },
    {
      id: "leptosporangiate",
      nameKey: "barnsley_preset_leptosporangiate",
      view: { centerX: 0, centerY: 3, scale: 8 },
      transforms: [
        { a: 0,    b: 0,     c: 0,     d: 0.18, e: 0, f: 0,   p: 0.01 },
        { a: 0.85, b: 0.02,  c: -0.02, d: 0.83, e: 0, f: 1.0, p: 0.85 },
        { a: 0.09, b: -0.28, c: 0.3,   d: 0.11, e: 0, f: 0.6, p: 0.93 },
        { a: -0.09,b: 0.28,  c: 0.3,   d: 0.09, e: 0, f: 0.7, p: 1.00 }
      ]
    },
    {
      id: "slender",
      nameKey: "barnsley_preset_slender",
      view: { centerX: 0, centerY: 8, scale: 22 },
      transforms: [
        { a: 0,    b: 0,    c: 0,     d: 0.16, e: 0, f: 0,   p: 0.01 },
        { a: 0.9,  b: 0.02, c: -0.02, d: 0.9,  e: 0, f: 1.8, p: 0.87 },
        { a: 0.15, b: -0.2, c: 0.2,   d: 0.15, e: 0, f: 1.2, p: 0.93 },
        { a: -0.15,b: 0.2,  c: 0.2,   d: 0.15, e: 0, f: 0.3, p: 1.00 }
      ]
    },
    {
      id: "spiral",
      nameKey: "barnsley_preset_spiral",
      view: { centerX: 0.5, centerY: 4.0, scale: 13 },
      transforms: [
        { a: 0,    b: 0,     c: 0,     d: 0.16, e: 0,   f: 0,    p: 0.01 },
        { a: 0.85, b: 0.06,  c: -0.06, d: 0.85, e: 0.1, f: 1.6,  p: 0.87 },
        { a: 0.18, b: -0.24, c: 0.22,  d: 0.2,  e: 0,   f: 1.6,  p: 0.93 },
        { a: -0.15,b: 0.28,  c: 0.24,  d: 0.22, e: 0.1, f: 0.44, p: 1.00 }
      ]
    },
    {
      id: "maple",
      nameKey: "barnsley_preset_maple",
      view: { centerX: 0.0, centerY: 0.0, scale: 10 },
      transforms: [
        { a: 0.14,  b: 0.01,  c: 0,     d: 0.51,  e: -0.08, f: -1.31, p: 0.10 },
        { a: 0.43,  b: 0.52,  c: -0.45, d: 0.5,   e: 1.49,  f: -0.75, p: 0.45 },
        { a: 0.45,  b: -0.49, c: 0.47,  d: 0.47,  e: -1.62, f: -0.74, p: 0.80 },
        { a: 0.49,  b: 0,     c: 0,     d: 0.51,  e: 0.02,  f: 1.62,  p: 1.00 }
      ]
    },
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];

  // ── 状态机 ──────────────────────────────────────────────────────
  // phase: "growing" | "dissolving" | "blank" | "idle"
  let phase = "idle";
  let animationId = null;
  let timeoutId = null;

  // 生长状态
  const MAX_POINTS = 700000;
  let pointsDrawn = 0;

  // 淡入状态
  const FADE_IN_FRAMES = 60;
  let fadeInFrame = FADE_IN_FRAMES; // 默认已完成，不淡入

  // 当前 view（供 dissolve 完成后重启使用）
  let currentView = null;

  // ── 工具函数 ─────────────────────────────────────────────────────
  function cancelAll() {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    if (timeoutId)   { clearTimeout(timeoutId);           timeoutId = null;   }
    phase = "idle";
  }

  function fitCanvasToDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = global.devicePixelRatio || 1;
    const width  = Math.max(320, Math.floor(rect.width  * ratio));
    const height = Math.max(320, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
    }
  }

  function nextPoint(x, y) {
    const r  = Math.random();
    const ts = activePreset.transforms;
    const t  = r < ts[0].p ? ts[0] : r < ts[1].p ? ts[1] : r < ts[2].p ? ts[2] : ts[3];
    return { nx: t.a * x + t.b * y + t.e, ny: t.c * x + t.d * y + t.f };
  }

  // ── 阶段函数 ─────────────────────────────────────────────────────

  // 阶段1：生长
  function startGrowing(canvas, view) {
    phase = "growing";
    pointsDrawn = 0;
    fadeInFrame = 0; // 每次生长都从淡入开始

    fitCanvasToDisplay(canvas);
    const ctx    = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 初始帧先画一批点，让蕨不从完全空白开始
    const width  = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;
    const xMin = view.centerX - scaleX / 2, xMax = view.centerX + scaleX / 2;
    const yMin = view.centerY - scaleY / 2, yMax = view.centerY + scaleY / 2;
    let x = Math.random(), y = Math.random();
    for (let i = 0; i < 3000; i++) {
      const { nx, ny } = nextPoint(x, y); x = nx; y = ny;
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        const px = (x - view.centerX) / scaleX * width + width / 2;
        const py = height / 2 - (y - view.centerY) / scaleY * height;
        const t = Math.max(0, Math.min(1, (y - yMin) / (yMax - yMin)));
        ctx.fillStyle = isDark
          ? `hsla(${80 + t * 80}, 75%, ${45 + t * 20}%, 0.6)`
          : `hsla(${80 + t * 80}, 80%, ${25 + t * 15}%, 0.6)`;
        ctx.fillRect(px, py, 1, 1);
        pointsDrawn++;
      }
    }

    animationId = requestAnimationFrame(() => tickGrow(canvas, view));
  }

  function tickGrow(canvas, view) {
    if (phase !== "growing") return;

    if (pointsDrawn >= MAX_POINTS) {
      // 生长完毕，进入淡出阶段
      animationId = null;
      startDissolve(canvas, () => {
        // 消散结束后空白停顿 1 秒，再重新生长同一变体
        phase = "blank";
        timeoutId = setTimeout(() => startGrowing(canvas, view), 1000);
      });
      return;
    }

    const ctx    = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    const width  = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;
    const xMin = view.centerX - scaleX / 2, xMax = view.centerX + scaleX / 2;
    const yMin = view.centerY - scaleY / 2, yMax = view.centerY + scaleY / 2;

    // 淡入：前 FADE_IN_FRAMES 帧逐渐提升不透明度
    if (fadeInFrame < FADE_IN_FRAMES) {
      fadeInFrame++;
      ctx.globalAlpha = fadeInFrame / FADE_IN_FRAMES;
    } else {
      ctx.globalAlpha = 1;
    }

    // 动态 batchSize 补偿缩放
    const FERN_TOTAL_AREA = 60;
    const coverageRatio = Math.min(1, (scaleX * scaleY) / FERN_TOTAL_AREA);
    const batchSize = Math.floor(1500 / Math.max(0.04, coverageRatio));

    let x = Math.random(), y = Math.random();
    for (let i = 0; i < batchSize; i++) {
      if (Math.random() < 0.8) continue;
      const { nx, ny } = nextPoint(x, y); x = nx; y = ny;
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
        const px = (x - view.centerX) / scaleX * width + width / 2;
        const py = height / 2 - (y - view.centerY) / scaleY * height;
        const t = Math.max(0, Math.min(1, (y - yMin) / (yMax - yMin)));
        ctx.fillStyle = isDark
          ? `hsla(${80 + t * 80}, 75%, ${45 + t * 20}%, 0.5)`
          : `hsla(${80 + t * 80}, 80%, ${25 + t * 15}%, 0.5)`;
        ctx.fillRect(px, py, 1, 1);
        pointsDrawn++;
      }
    }

    ctx.globalAlpha = 1;
    animationId = requestAnimationFrame(() => tickGrow(canvas, view));
  }

  // 阶段2：淡出消散
  function startDissolve(canvas, onDone) {
    phase = "dissolving";
    const ctx    = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    const bgColor = isDark ? "rgba(18,18,18,0.08)" : "rgba(255,255,255,0.08)";
    const FADE_FRAMES = 50;
    let frame = 0;

    function step() {
      if (phase !== "dissolving") return; // 被外部中断则停止
      if (frame < FADE_FRAMES) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        frame++;
        animationId = requestAnimationFrame(step);
      } else {
        const bg = isDark ? "#121212" : "#ffffff";
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animationId = null;
        onDone();
      }
    }
    animationId = requestAnimationFrame(step);
  }

  // ── 对外接口 ─────────────────────────────────────────────────────

  function cleanup() {
    cancelAll();
  }

  // 外部调用：初次绘制或重绘（缩放/resize 时）
  function draw(canvas, view, subsampling = 1) {
    cancelAll();
    currentView = view;
    if (subsampling === 1) {
      startGrowing(canvas, view);
    }
    // subsampling > 1 时只做缩略图预览，不启动动画（原逻辑）
  }

  // 外部调用：随机切换到下一个变体
  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    activePreset = PRESETS[currentPresetIndex];
    currentView = { ...activePreset.view };

    // 停掉一切，直接开始淡出，结束后生长新变体
    cancelAll();
    startDissolve(canvas, () => {
      phase = "blank";
      timeoutId = setTimeout(() => startGrowing(canvas, currentView), 500);
    });

    return { ...activePreset.view };
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    BarnsleyFern: {
      id: "BarnsleyFern",
      get defaultView() { return { ...activePreset.view }; },
      draw,
      cleanup,
      randomize,
      get currentNameKey() { return activePreset.nameKey; },
      explanationUrl: "/tools/math-wonder-box/barnsley-fern.html",
    },
  };
})(window);
