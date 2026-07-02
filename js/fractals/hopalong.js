(function registerHopalongAttractor(global) {
  const PRESETS = [
    { a: 2.0,  b: 0.1,  c: 0.1,  maxPoints: 1500000, nameKey: "hopalong_preset_standard" },
    { a: 0.4,  b: 1.0,  c: 0.0,  maxPoints: 5000000, nameKey: "hopalong_preset_dots"     },
    { a: 8.4,  b: 0.5,  c: 0.5,  maxPoints: 5467000, nameKey: "hopalong_preset_star"     },
    { a: 11.0, b: 0.1,  c: 0.1,  maxPoints: 4800000, nameKey: "hopalong_preset_galaxy"   },
    { a: 200,  b: 0.1,  c: 0.1,  maxPoints: 1500000, nameKey: "hopalong_preset_nebula"   },
    { a: -11,  b: 0.05, c: 0.05, maxPoints: 5000000, nameKey: "hopalong_preset_vortex"   },
    { a: 1.1,  b: 0.5,  c: 0.5,  maxPoints: 1500000, nameKey: "hopalong_preset_crystal"  }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let baseParams = { ...PRESETS[currentPresetIndex] };

  function calculateOptimalView(canvas, params) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let x = 0.0, y = 0.0;
    const a = parseFloat(params.a);
    const b = parseFloat(params.b);
    const c = parseFloat(params.c);

    // High-precision boundary finding
    for (let i = 0; i < 150000; i++) {
      const nx = y - Math.sign(x) * Math.sqrt(Math.abs(b * x - c));
      const ny = a - x;
      x = nx; y = ny;
      if (i > 1000) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    const patternWidth = maxX - minX;
    const patternHeight = maxY - minY;
    const rect = canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    
    // Scale factor with explicit margin (approx 70% coverage for "full fence")
    const scale = Math.max(patternWidth / aspect, patternHeight) * 5;

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      scale: Math.max(scale, 0.1)
    };
  }

  let animationId = null;
  let currentX = 0.0;
  let currentY = 0.0;
  let time = 0;
  let pointsDrawn = 0; // Track total points drawn for dynamic speed
  let holdStartTime = null;

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    holdStartTime = null;
  }

  function reset() {
    currentX = 0.0;
    currentY = 0.0;
    pointsDrawn = 0;
    time = 0;
    holdStartTime = null;
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    
    baseParams = {
      a: (preset.a + (Math.random() - 0.5) * (Math.abs(preset.a) * 0.1)).toFixed(3),
      b: (preset.b + (Math.random() - 0.5) * 0.02).toFixed(3),
      c: (preset.c + (Math.random() - 0.5) * 0.02).toFixed(3),
      maxPoints: preset.maxPoints
    };
    
    reset();

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

    // Check if we reached the limit
    if (pointsDrawn >= baseParams.maxPoints) {
      if (!holdStartTime) {
        holdStartTime = performance.now();
      }

      const elapsed = performance.now() - holdStartTime;
      
      if (elapsed < 2000) {
        // Phase 1: Hold static for 2 seconds
        animationId = requestAnimationFrame(() => tick(canvas, view));
        return;
      } else if (elapsed < 4000) {
        // Phase 2: Fade-out for 2 seconds
        const fadeProgress = (elapsed - 2000) / 2000;
        // Accelerating fade-out to ensure zero residue/ghosting
        const alpha = Math.min(1, 0.05 + Math.pow(fadeProgress, 4) * 0.95);
        
        ctx.fillStyle = isDark 
          ? `rgba(18, 18, 18, ${alpha})` 
          : `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(0, 0, width, height);
        
        animationId = requestAnimationFrame(() => tick(canvas, view));
        return;
      } else {
        // Phase 3: Restart
        reset();
        draw(canvas, view);
        return; 
      }
    }

    // Aggressive cleanup: Faster ramp and higher minimum alpha to ensure pure background
    const t = Math.min(1, pointsDrawn / 200000);
    const fadeAlpha = 0.05 + t * 0.15; // 0.05 to 0.20

    ctx.fillStyle = isDark
      ? `rgba(18, 18, 18, ${fadeAlpha})`
      : `rgba(255, 255, 255, ${fadeAlpha})`;
    ctx.fillRect(0, 0, width, height);

    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    time += 0.01;
    const a = parseFloat(baseParams.a);
    const b = parseFloat(baseParams.b);
    const c = parseFloat(baseParams.c);

    const hue = (time * 10) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 70%, 40%, 0.5)`;
    }
    
    let batchSize;
    const p = pointsDrawn;

    if (p < 50000) {
      batchSize = 1 + (p / 50000) * 49;          // 1 → 50
    } else if (p < 300000) {
      batchSize = 50 + ((p - 50000) / 250000) * 950;   // 50 → 1000
    } else {
      batchSize = 1000 + ((p - 300000) / 700000) * 14000; // 1000 → 15000
      batchSize = Math.min(batchSize, 15000);
    }
    batchSize = Math.round(batchSize);

    for (let i = 0; i < batchSize; i++) {
      const nx = currentY - Math.sign(currentX) * Math.sqrt(Math.abs(b * currentX - c));
      const ny = a - currentX;
      currentX = nx;
      currentY = ny;

      const px = (currentX - view.centerX) / scaleX * width + width / 2;
      const py = (currentY - view.centerY) / scaleY * height + height / 2;

      if (px >= 0 && px < width && py >= 0 && py < height) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
    
    pointsDrawn = Math.min(baseParams.maxPoints, pointsDrawn + batchSize);

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();

    const resized = fitCanvasToDisplay(canvas);
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    // Only clear if resized, fresh start, or dragging (subsampling > 1)
    if (resized || pointsDrawn === 0 || subsampling > 1) {
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // For smooth zoom, apply a very strong "recession" layer (80% opacity)
      // This virtually clears the screen while keeping the transition frame-linked.
      ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.8)" : "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const width = canvas.width;
    const height = canvas.height;
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;
    const a = parseFloat(baseParams.a);
    const b = parseFloat(baseParams.b);
    const c = parseFloat(baseParams.c);

    // Burst render for instant feedback
    const hue = (time * 10) % 360;
    if (isDark) {
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.5)`;
    } else {
      ctx.fillStyle = `hsla(${hue}, 70%, 40%, 0.5)`;
    }

    const burstIterations = subsampling > 1 ? 20000 : 100000;
    
    for (let i = 0; i < burstIterations; i++) {
      const nx = currentY - Math.sign(currentX) * Math.sqrt(Math.abs(b * currentX - c));
      const ny = a - currentX;
      currentX = nx;
      currentY = ny;

      const px = (currentX - view.centerX) / scaleX * width + width / 2;
      const py = (currentY - view.centerY) / scaleY * height + height / 2;

      if (px >= 0 && px < width && py >= 0 && py < height) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
    
    pointsDrawn = Math.min(baseParams.maxPoints, pointsDrawn + burstIterations);

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    }
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Hopalong: {
      id: "Hopalong",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas"), baseParams); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      reset,
      randomize,
      formula: "xₙ₊₁ = yₙ - sign(xₙ)√(abs(bxₙ - c)), yₙ₊₁ = a - xₙ",
      // explanationUrl: "explanations/hopalong.html",
    },
  };
})(window);
