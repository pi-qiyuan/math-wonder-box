(function registerHilbertCurve(global) {
  const PRESETS = [
    { id: "classic_circuit", nameKey: "hilbert_preset_classic_circuit", order: 6, driftSpeed: 0.5, colorType: "emerald"     },
    { id: "golden_maze",     nameKey: "hilbert_preset_golden_maze",     order: 5, driftSpeed: 0.4, colorType: "gold-purple" },
    { id: "rainbow_path",    nameKey: "hilbert_preset_rainbow_path",    order: 6, driftSpeed: 0.6, colorType: "rainbow"     },
    { id: "neon_grid",       nameKey: "hilbert_preset_neon_grid",       order: 7, driftSpeed: 0.3, colorType: "nebula"      },
    { id: "violet_web",      nameKey: "hilbert_preset_violet_web",      order: 6, driftSpeed: 0.4, colorType: "violet"      },
    { id: "fire_flow",       nameKey: "hilbert_preset_fire_flow",       order: 5, driftSpeed: 0.5, colorType: "fire"        }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0, scale: 2.2 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    cleanup();
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    time = 0;
    return calculateOptimalView(canvas);
  }

  // Map 1D distance along the curve to 2D coordinates
  function getHilbertXY(i, order) {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 }
    ];
    let index = i & 3;
    let x = points[index].x;
    let y = points[index].y;

    for (let j = 1; j < order; j++) {
      i = i >>> 2;
      index = i & 3;
      let len = Math.pow(2, j);
      if (index === 0) {
        let temp = x;
        x = y;
        y = temp;
      } else if (index === 1) {
        y += len;
      } else if (index === 2) {
        x += len;
        y += len;
      } else if (index === 3) {
        let temp = len - 1 - x;
        x = len - 1 - y;
        y = temp;
        x += len;
      }
    }
    return { x, y };
  }

  function drawHilbertScene(ctx, width, height, view, preset, time, isDark, subsampling) {
    const order = preset.order;
    const n = Math.pow(2, order);
    const totalPoints = n * n;
    
    // Growth animation: draw from 0 up to the full curve, pause at full,
    // then shrink back down to 0 (reverse), then loop and grow from zero again.
    const growDuration = 45;  // time units to grow from 0 to full (3x slower than before)
    const pauseDuration = 2.4;  // time units to hold at full length
    const shrinkDuration = 16.8; // time units to shrink back down to 0
    const cycleDuration = growDuration + pauseDuration + shrinkDuration;

    const cyclePos = time % cycleDuration;
    let growProgress;
    if (cyclePos < growDuration) {
      growProgress = cyclePos / growDuration;
    } else if (cyclePos < growDuration + pauseDuration) {
      growProgress = 1;
    } else {
      const shrinkPos = cyclePos - growDuration - pauseDuration;
      growProgress = 1 - shrinkPos / shrinkDuration;
    }
    const drawLimit = Math.floor(totalPoints * growProgress);
    
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // Hilbert coordinates go from 0 to n-1. 
    // We want to map this into a centered square from roughly -1 to 1.
    const hToMath = (val) => (val / (n - 1)) * 2 - 1;

    ctx.beginPath();
    for (let i = 0; i < drawLimit; i++) {
      const hp = getHilbertXY(i, order);
      const mx = hToMath(hp.x);
      const my = hToMath(hp.y);

      const px = ((mx - view.centerX) / scaleX) * width + width / 2;
      const py = ((my - view.centerY) / scaleY) * height + height / 2;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Coloring
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (preset.colorType === "rainbow") {
      for (let j = 0; j <= 5; j++) {
        const f = j / 5;
        const hue = (f * 360 + time * 50) % 360;
        grad.addColorStop(f, `hsla(${hue}, 85%, ${isDark ? 65 : 45}%, 0.8)`);
      }
    } else if (preset.colorType === "emerald") {
      grad.addColorStop(0, `hsla(160, 80%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(1, `hsla(200, 90%, ${isDark ? 50 : 30}%, 0.8)`);
    } else if (preset.colorType === "gold-purple") {
      grad.addColorStop(0, `hsla(45, 95%, ${isDark ? 65 : 45}%, 0.8)`);
      grad.addColorStop(1, `hsla(280, 85%, ${isDark ? 55 : 35}%, 0.8)`);
    } else if (preset.colorType === "nebula") {
      grad.addColorStop(0, `hsla(280, 90%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(1, `hsla(200, 90%, ${isDark ? 50 : 35}%, 0.8)`);
    } else if (preset.colorType === "fire") {
      grad.addColorStop(0, `hsla(40, 95%, ${isDark ? 75 : 55}%, 0.8)`);
      grad.addColorStop(1, `hsla(0, 95%, ${isDark ? 55 : 35}%, 0.8)`);
    } else if (preset.colorType === "violet") {
      grad.addColorStop(0, `hsla(250, 80%, ${isDark ? 75 : 55}%, 0.8)`);
      grad.addColorStop(1, `hsla(300, 80%, ${isDark ? 55 : 35}%, 0.8)`);
    }

    ctx.save();
    ctx.strokeStyle = grad;
    // Base line width on zoom level
    const baseWidth = (width / n) * 0.5 / (view.scale / 2.2);
    ctx.lineWidth = subsampling === 1 ? Math.max(1.5, baseWidth) : Math.max(1, baseWidth * 0.5);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    
    if (subsampling === 1) {
      ctx.shadowBlur = 4;
      ctx.shadowColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
    }
    
    ctx.stroke();
    ctx.restore();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    drawHilbertScene(ctx, width, height, view, preset, time, isDark, 1);

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
      ctx.fillRect(0, 0, width, height);
      drawHilbertScene(ctx, width, height, view, preset, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    HilbertCurve: {
      id: "HilbertCurve",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      /*
      get formula() { 
        return PRESETS[currentPresetIndex].formula;
      },
      explanationUrl: "explanations/hilbert_curve.html",
      */
    },
  };
})(window);
