(function registerKochSnowflake(global) {
  const PRESETS = [
    { id: "icy_crystal",     nameKey: "koch_preset_icy",     maxDepth: 5, colorType: "ice",    },
    { id: "neon_pulse",      nameKey: "koch_preset_neon",    maxDepth: 4, colorType: "neon",   },
    { id: "golden_flake",    nameKey: "koch_preset_golden",  maxDepth: 5, colorType: "gold",   },
    { id: "rainbow_fractal", nameKey: "koch_preset_rainbow", maxDepth: 4, colorType: "rainbow" }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0.2, scale: 2.5 };
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
    
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    time = 0;
    return calculateOptimalView(canvas);
  }

  function drawKochLine(ctx, x1, y1, x2, y2, depth, maxDepth, time, isDark, colorType) {
    if (depth === 0) {
      ctx.lineTo(x2, y2);
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Divide segment into 3 parts
    const xA = x1 + dx / 3;
    const yA = y1 + dy / 3;

    const xC = x1 + 2 * dx / 3;
    const yC = y1 + 2 * dy / 3;

    // The peak of the triangle
    // Rotate (dx/3, dy/3) by 60 degrees (-PI/3)
    const angle = -Math.PI / 3;
    const cos60 = Math.cos(angle);
    const sin60 = Math.sin(angle);
    
    const xB = xA + (dx / 3) * cos60 - (dy / 3) * sin60;
    const yB = yA + (dx / 3) * sin60 + (dy / 3) * cos60;

    drawKochLine(ctx, x1, y1, xA, yA, depth - 1, maxDepth, time, isDark, colorType);
    drawKochLine(ctx, xA, yA, xB, yB, depth - 1, maxDepth, time, isDark, colorType);
    drawKochLine(ctx, xB, yB, xC, yC, depth - 1, maxDepth, time, isDark, colorType);
    drawKochLine(ctx, xC, yC, x2, y2, depth - 1, maxDepth, time, isDark, colorType);
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.02;

    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // Starting equilateral triangle
    const size = 1.5;
    const h = size * Math.sqrt(3) / 2;
    
    // Triangle vertices in math units
    const p1 = { x: 0, y: size * 2/3 };
    const p2 = { x: -size/2, y: -size/3 };
    const p3 = { x: size/2, y: -size/3 };

    // Map to pixel units
    const toPx = (p) => ({
      x: (p.x - view.centerX) / scaleX * width + width / 2,
      y: (p.y - view.centerY) / scaleY * height + height / 2
    });

    const v1 = toPx(p1);
    const v2 = toPx(p2);
    const v3 = toPx(p3);

    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    
    let color;
    if (preset.colorType === "ice") {
      color = isDark ? "#a5f3fc" : "#0891b2";
    } else if (preset.colorType === "neon") {
      color = `hsla(${(time * 50) % 360}, 100%, 60%, 1)`;
    } else if (preset.colorType === "gold") {
      color = "#fbbf24";
    } else if (preset.colorType === "rainbow") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `hsla(${time * 30 % 360}, 80%, 60%, 1)`);
      grad.addColorStop(1, `hsla(${(time * 30 + 180) % 360}, 80%, 60%, 1)`);
      color = grad;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    drawKochLine(ctx, v1.x, v1.y, v2.x, v2.y, preset.maxDepth, preset.maxDepth, time, isDark, preset.colorType);
    drawKochLine(ctx, v2.x, v2.y, v3.x, v3.y, preset.maxDepth, preset.maxDepth, time, isDark, preset.colorType);
    drawKochLine(ctx, v3.x, v3.y, v1.x, v1.y, preset.maxDepth, preset.maxDepth, time, isDark, preset.colorType);
    
    ctx.stroke();

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      // Simplified static draw for dragging
      const ctx = canvas.getContext("2d");
      const isDark = document.documentElement.classList.contains("theme-dark");
      ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;
      const size = 1.5;
      const toPx = (p) => ({
        x: (p.x - view.centerX) / scaleX * width + width / 2,
        y: (p.y - view.centerY) / scaleY * height + height / 2
      });
      const v1 = toPx({ x: 0, y: size * 2/3 });
      const v2 = toPx({ x: -size/2, y: -size/3 });
      const v3 = toPx({ x: size/2, y: -size/3 });

      ctx.beginPath();
      ctx.moveTo(v1.x, v1.y);
      ctx.strokeStyle = isDark ? "#cbd5e1" : "#475569";
      ctx.lineWidth = 1;
      drawKochLine(ctx, v1.x, v1.y, v2.x, v2.y, 3, 3, time, isDark, "static");
      drawKochLine(ctx, v2.x, v2.y, v3.x, v3.y, 3, 3, time, isDark, "static");
      drawKochLine(ctx, v3.x, v3.y, v1.x, v1.y, 3, 3, time, isDark, "static");
      ctx.stroke();
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    KochSnowflake: {
      id: "KochSnowflake",
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
      explanationUrl: "explanations/koch_snowflake.html",
      */
    },
  };
})(window);
