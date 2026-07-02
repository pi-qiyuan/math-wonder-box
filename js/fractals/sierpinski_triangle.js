(function registerSierpinskiTriangle(global) {
  const PRESETS = [
    { id: "golden_pyramid",  nameKey: "sierpinski_tri_preset_golden",  maxDepth: 8, driftSpeed: 0.5, colorType: "gold-purple" },
    { id: "emerald_peak",    nameKey: "sierpinski_tri_preset_emerald", maxDepth: 7, driftSpeed: 0.4, colorType: "emerald",    },
    { id: "rainbow_trinity", nameKey: "sierpinski_tri_preset_rainbow", maxDepth: 8, driftSpeed: 0.6, colorType: "rainbow",    },
    { id: "cosmic_fractal",  nameKey: "sierpinski_tri_preset_nebula",  maxDepth: 9, driftSpeed: 0.3, colorType: "nebula",     },
    { id: "fire_summit",     nameKey: "sierpinski_tri_preset_fire",    maxDepth: 8, driftSpeed: 0.5, colorType: "fire",       },
    { id: "violet_prism",    nameKey: "sierpinski_tri_preset_violet",  maxDepth: 7, driftSpeed: 0.4, colorType: "violet",     }
  ];

  const VERTICAL_OFFSET_PX = 80; // 所有 preset 的图形统一向上偏移的像素数

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    // Triangle is taller than wide, adjust center Y slightly
    return { centerX: 0, centerY: 0.1, scale: 2.5 };
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

  function drawTriangle(ctx, x1, y1, x2, y2, x3, y3, depth, maxDepth, time, isDark, colorType) {
    if (depth === maxDepth) {
      // Draw the smallest triangle
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      
      let color;
      if (colorType === "rainbow") {
        color = `hsla(${(time * 40 + depth * 20) % 360}, 80%, ${isDark ? 65 : 45}%, 0.8)`;
      } else if (colorType === "emerald") {
        color = `hsla(160, 80%, ${isDark ? 75 - depth * 4 : 35 + depth * 4}%, 0.8)`;
      } else if (colorType === "gold-purple") {
        color = depth % 2 === 0 ? `hsla(45, 95%, ${isDark ? 65 : 45}%, 0.8)` : `hsla(280, 80%, ${isDark ? 55 : 35}%, 0.8)`;
      } else if (colorType === "nebula") {
        color = `hsla(${(280 + depth * 15) % 360}, 85%, ${isDark ? 70 : 50}%, 0.8)`;
      } else if (colorType === "fire") {
        color = `hsla(${(15 + depth * 5) % 360}, 95%, ${isDark ? 70 : 50}%, 0.8)`;
      } else if (colorType === "violet") {
        color = `hsla(270, 75%, ${isDark ? 75 - depth * 5 : 30 + depth * 5}%, 0.8)`;
      }
      
      ctx.fillStyle = color;
      ctx.fill();
      return;
    }

    // Midpoints
    const mx12 = (x1 + x2) / 2;
    const my12 = (y1 + y2) / 2;
    const mx23 = (x2 + x3) / 2;
    const my23 = (y2 + y3) / 2;
    const mx31 = (x3 + x1) / 2;
    const my31 = (y3 + y1) / 2;

    // Pulse effect: slightly shift midpoints to create a breathing interior
    const pulse = Math.sin(time + depth * 0.5) * 2;
    const px = mx23 + (mx23 - (x1+x2+x3)/3) * 0.05 * pulse;
    const py = my23 + (my23 - (y1+y2+y3)/3) * 0.05 * pulse;

    // Recursively draw the 3 sub-triangles
    drawTriangle(ctx, x1, y1, mx12, my12, mx31, my31, depth + 1, maxDepth, time, isDark, colorType);
    drawTriangle(ctx, mx12, my12, x2, y2, px, py, depth + 1, maxDepth, time, isDark, colorType);
    drawTriangle(ctx, mx31, my31, px, py, x3, y3, depth + 1, maxDepth, time, isDark, colorType);
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

    // Map the main equilateral triangle vertices
    // Top: (0, 1), Bottom Left: (-1, -1), Bottom Right: (1, -1) in math units
    // Note: canvas y grows downward, so math y must be negated when mapping to screen space
    const h = Math.sqrt(3);
    const v1x = (0 - view.centerX) / scaleX * width + width / 2;
    const v1y = (view.centerY - 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;
    const v2x = (-1 - view.centerX) / scaleX * width + width / 2;
    const v2y = (view.centerY + 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;
    const v3x = (1 - view.centerX) / scaleX * width + width / 2;
    const v3y = (view.centerY + 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;

    drawTriangle(ctx, v1x, v1y, v2x, v2y, v3x, v3y, 0, preset.maxDepth, time, isDark, preset.colorType);

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

      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;

      const v1x = (0 - view.centerX) / scaleX * width + width / 2;
      const v1y = (view.centerY - 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;
      const v2x = (-1 - view.centerX) / scaleX * width + width / 2;
      const v2y = (view.centerY + 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;
      const v3x = (1 - view.centerX) / scaleX * width + width / 2;
      const v3y = (view.centerY + 1) / scaleY * height + height / 2 - VERTICAL_OFFSET_PX;

      drawTriangle(ctx, v1x, v1y, v2x, v2y, v3x, v3y, 0, Math.min(preset.maxDepth, 5), time, isDark, preset.colorType);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    SierpinskiTriangle: {
      id: "SierpinskiTriangle",
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
      */
      // explanationUrl: "explanations/sierpinski_triangle.html",
    },
  };
})(window);
