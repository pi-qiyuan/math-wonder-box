(function registerSierpinskiCarpet(global) {
  const PRESETS = [
    { id: "classic_gold",    nameKey: "sierpinski_preset_classic_gold",    maxDepth: 5, driftSpeed: 0.5, colorType: "gold-purple" },
    { id: "emerald_void",    nameKey: "sierpinski_preset_emerald_void",    maxDepth: 4, driftSpeed: 0.4, colorType: "emerald",    },
    { id: "rainbow_fractal", nameKey: "sierpinski_preset_rainbow_fractal", maxDepth: 5, driftSpeed: 0.6, colorType: "rainbow",    },
    { id: "nebula_grid",     nameKey: "sierpinski_preset_nebula_grid",     maxDepth: 6, driftSpeed: 0.3, colorType: "nebula",     },
    { id: "fire_matrix",     nameKey: "sierpinski_preset_fire_matrix",     maxDepth: 5, driftSpeed: 0.5, colorType: "fire",       },
    { id: "violet_lattice",  nameKey: "sierpinski_preset_violet_lattice",  maxDepth: 4, driftSpeed: 0.4, colorType: "violet",     }
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
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    
    // Clear canvas
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    time = 0;
    return calculateOptimalView(canvas);
  }

  function drawCarpet(ctx, x, y, size, depth, maxDepth, time, isDark, colorType) {
    if (depth === maxDepth) return;

    const newSize = size / 3;
    
    // Draw the central square (the "hole")
    const holePulse = 0.85 + 0.15 * Math.sin(time + depth * 0.4);
    const drawSize = newSize * holePulse;
    const offset = (newSize - drawSize) / 2;

    // Coloring
    let color;
    if (colorType === "rainbow") {
      color = `hsla(${(time * 30 + depth * 40) % 360}, 80%, ${isDark ? 65 : 45}%, 0.85)`;
    } else if (colorType === "emerald") {
      color = `hsla(160, 80%, ${isDark ? 70 - depth * 8 : 40 + depth * 6}%, 0.85)`;
    } else if (colorType === "gold-purple") {
      color = depth % 2 === 0 ? `hsla(45, 90%, ${isDark ? 65 : 45}%, 0.85)` : `hsla(280, 80%, ${isDark ? 55 : 35}%, 0.85)`;
    } else if (colorType === "nebula") {
      color = `hsla(${(280 + depth * 25) % 360}, 85%, ${isDark ? 65 : 45}%, 0.85)`;
    } else if (colorType === "fire") {
      color = `hsla(${(10 + depth * 15) % 360}, 95%, ${isDark ? 70 : 50}%, 0.85)`;
    } else if (colorType === "violet") {
      color = `hsla(270, 75%, ${isDark ? 75 - depth * 10 : 35 + depth * 10}%, 0.85)`;
    }

    ctx.fillStyle = color;
    ctx.fillRect(x + newSize + offset, y + newSize + offset, drawSize, drawSize);

    // Recursively draw the 8 surrounding squares
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) continue;
        drawCarpet(ctx, x + i * newSize, y + j * newSize, newSize, depth + 1, maxDepth, time, isDark, colorType);
      }
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    // Standard clear
    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.015;

    // Coordinate mapping that respects view.centerX, view.centerY and view.scale
    // view.scale is the "diameter" of the viewport in mathematical units.
    // The carpet spans from -1 to 1 in mathematical units (diameter 2).
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // Calculate the pixels for the bounds of the carpet
    // Map -1 to ((-1 - centerX) / scaleX * width + width/2)
    // Map 1 to ((1 - centerX) / scaleX * width + width/2)
    const xMin = ((-1 - view.centerX) / scaleX) * width + width / 2;
    const xMax = ((1 - view.centerX) / scaleX) * width + width / 2;
    const yMin = ((-1 - view.centerY) / scaleY) * height + height / 2;
    const yMax = ((1 - view.centerY) / scaleY) * height + height / 2;

    const drawWidth = xMax - xMin;
    const drawHeight = yMax - yMin;
    const size = Math.min(drawWidth, drawHeight);
    
    // Center it on the mapped coordinates
    const startX = (xMin + xMax) / 2 - size / 2;
    const startY = (yMin + yMax) / 2 - size / 2;

    ctx.save();
    // Fill the base square first to define the carpet area
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(startX, startY, size, size);

    drawCarpet(ctx, startX, startY, size, 0, preset.maxDepth, time, isDark, preset.colorType);
    ctx.restore();

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      // Static draw for dragging/interaction
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      
      ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;

      const xMin = ((-1 - view.centerX) / scaleX) * width + width / 2;
      const xMax = ((1 - view.centerX) / scaleX) * width + width / 2;
      const yMin = ((-1 - view.centerY) / scaleY) * height + height / 2;
      const yMax = ((1 - view.centerY) / scaleY) * height + height / 2;

      const size = Math.min(xMax - xMin, yMax - yMin);
      const startX = (xMin + xMax) / 2 - size / 2;
      const startY = (yMin + yMax) / 2 - size / 2;

      ctx.save();
      drawCarpet(ctx, startX, startY, size, 0, Math.min(preset.maxDepth, 4), time, isDark, preset.colorType);
      ctx.restore();
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    SierpinskiCarpet: {
      id: "SierpinskiCarpet",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      get formula() { 
        return PRESETS[currentPresetIndex].formula;
      },
      // explanationUrl: "explanations/sierpinski_carpet.html",
    },
  };
})(window);
