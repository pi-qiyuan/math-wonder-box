(function registerFibonacciTree(global) {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const MAX_DEPTH = 12;
  const GROW_SPEED = 0.025;

  const PRESETS = [
    { id: "classic-tree",  nameKey: "fibonacci_tree_preset_classic",  r1: 0.72,    r2: 0.72,            angle1: -Math.PI / 8,    angle2: Math.PI / 8,   branchColor: "nature"   },
    { id: "winter-tree",   nameKey: "fibonacci_tree_preset_winter",   r1: 0.8,     r2: 0.5,             angle1: -Math.PI / 15,   angle2: Math.PI / 3.5, branchColor: "gray"     },
    { id: "sakura-tree",   nameKey: "fibonacci_tree_preset_sakura",   r1: 0.75,    r2: 0.75,            angle1: -Math.PI / 4,    angle2: Math.PI / 4,   branchColor: "sakura"   },
    { id: "coral-tree",    nameKey: "fibonacci_tree_preset_coral",    r1: 0.85,    r2: 0.4,             angle1: -Math.PI / 10,   angle2: Math.PI / 2.5, branchColor: "coral"    },
    { id: "autumn-tree",   nameKey: "fibonacci_tree_preset_autumn",   r1: 0.8,     r2: 0.8,             angle1: -Math.PI / 12,   angle2: Math.PI / 12,  branchColor: "autumn"   },
    { id: "neon-tree",     nameKey: "fibonacci_tree_preset_neon",     r1: 0.78,    r2: 0.78,            angle1: -Math.PI / 6,    angle2: Math.PI / 6,   branchColor: "neon"     },
    { id: "bonsai-tree",   nameKey: "fibonacci_tree_preset_bonsai",   r1: 0.88,    r2: 0.88,            angle1: -Math.PI / 24,   angle2: Math.PI / 24,  branchColor: "bonsai"   },
    { id: "midnight-tree", nameKey: "fibonacci_tree_preset_midnight", r1: 0.7,     r2: 0.65,            angle1: -Math.PI / 3,    angle2: Math.PI / 6,   branchColor: "midnight" },
    { id: "ocean-tree",    nameKey: "fibonacci_tree_preset_ocean",    r1: 0.75,    r2: 0.55,            angle1: -Math.PI / 6,    angle2: -Math.PI / 18, branchColor: "ocean"    },
    { id: "emerald-tree",  nameKey: "fibonacci_tree_preset_emerald",  r1: 0.7,     r2: 0.65,            angle1: -Math.PI / 2.25, angle2: Math.PI / 9,   branchColor: "emerald"  },
    { id: "frost-tree",    nameKey: "fibonacci_tree_preset_frost",    r1: 0.71,    r2: 0.71,            angle1: -Math.PI / 2.5,  angle2: Math.PI / 2.5, branchColor: "frost"    },
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let growth = 0;
  let pauseTimer = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0.0, scale: 1.0 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    reset();
    return calculateOptimalView(canvas);
  }

  function reset() {
    growth = 0;
    time = 0;
    pauseTimer = 0;
  }

  function drawBranch(ctx, length, depth, preset, isDark) {
    if (depth <= 0) return;

    const opacity = Math.min(depth, 1.0);
    const scale = Math.min(depth, 1.0);

    ctx.save();
    ctx.globalAlpha *= opacity;

    // Draw current branch
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -length * scale);
    ctx.lineWidth = Math.max(0.5, depth * 0.8);
    ctx.lineCap = "round";
    
    // Color logic
    const colorDepth = depth / MAX_DEPTH;
    if (preset.branchColor === "golden") {
        ctx.strokeStyle = `rgba(212, 175, 55, ${0.4 + colorDepth})`;
    } else if (preset.branchColor === "nature") {
        const green = 100 + colorDepth * 100;
        ctx.strokeStyle = `rgba(60, ${green}, 60, ${0.5 + colorDepth * 0.5})`;
    } else if (preset.branchColor === "sakura") {
        const red = 230 + colorDepth * 25;
        const green = 180 + colorDepth * 20;
        ctx.strokeStyle = `rgba(${red}, ${green}, 197, ${0.6 + colorDepth * 0.4})`;
    } else if (preset.branchColor === "coral") {
        ctx.strokeStyle = `hsla(${200 + colorDepth * 60}, 80%, 60%, ${0.5 + colorDepth * 0.5})`;
    } else if (preset.branchColor === "autumn") {
        const red = 180 + colorDepth * 75;
        const green = 50 + colorDepth * 100;
        ctx.strokeStyle = `rgba(${red}, ${green}, 20, ${0.5 + colorDepth * 0.5})`;
    } else if (preset.branchColor === "neon") {
        ctx.strokeStyle = `hsla(${280 + colorDepth * 100}, 100%, 70%, ${0.7 + colorDepth * 0.3})`;
    } else if (preset.branchColor === "bonsai") {
        const gray = 40 + colorDepth * 40;
        ctx.strokeStyle = isDark ? `rgba(${gray+100}, ${gray+100}, ${gray+100}, 0.9)` : `rgba(${gray}, ${gray}, ${gray}, 0.9)`;
    } else if (preset.branchColor === "midnight") {
        ctx.strokeStyle = `hsla(${240 + colorDepth * 40}, 60%, ${20 + colorDepth * 30}%, ${0.6 + colorDepth * 0.4})`;
    } else if (preset.branchColor === "ocean") {
        ctx.strokeStyle = `hsla(${190 + colorDepth * 40}, 80%, 45%, ${0.6 + colorDepth * 0.4})`;
    } else if (preset.branchColor === "emerald") {
        ctx.strokeStyle = `hsla(${140 + colorDepth * 40}, 70%, 35%, ${0.6 + colorDepth * 0.4})`;
    } else if (preset.branchColor === "frost") {
        const light = isDark ? 180 : 80;
        ctx.strokeStyle = `rgba(${light + colorDepth * 40}, ${light + colorDepth * 75}, 255, ${0.5 + colorDepth * 0.5})`;
    } else {
        const finalOpacity = 0.3 + colorDepth * 0.7;
        ctx.strokeStyle = isDark ? `rgba(200, 200, 200, ${finalOpacity})` : `rgba(60, 60, 60, ${finalOpacity})`;
    }
    ctx.stroke();

    // Move to end of branch
    ctx.translate(0, -length * scale);

    if (depth > 1) {
        // Dynamic sway
        const sway = Math.sin(time + depth * 0.5) * 0.03;

        // Left branch
        ctx.save();
        ctx.rotate(preset.angle1 + sway);
        drawBranch(ctx, length * preset.r1, depth - 1, preset, isDark);
        ctx.restore();

        // Right branch
        ctx.save();
        ctx.rotate(preset.angle2 + sway);
        drawBranch(ctx, length * preset.r2, depth - 1, preset, isDark);
        ctx.restore();
    }
    
    ctx.restore();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    time += 0.015;
    if (growth < MAX_DEPTH) {
        growth += GROW_SPEED;
    } else {
        pauseTimer += 1;
        if (pauseTimer > 60 * 10) { // 5 seconds at ~60fps
            reset();
        }
    }

    const preset = PRESETS[currentPresetIndex];
    const width = canvas.width;
    const height = canvas.height;
    
    // Position at bottom center
    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height * 0.8 - (view.centerY * height / view.scale);
    const baseLength = (height / 5) / view.scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    drawBranch(ctx, baseLength, Math.min(growth, MAX_DEPTH), preset, isDark);
    ctx.restore();
    
    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const ctx = canvas.getContext("2d");
      const isDark = document.documentElement.classList.contains("theme-dark");
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const preset = PRESETS[currentPresetIndex];
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height * 0.8 - (view.centerY * height / view.scale);
      const baseLength = (height / 5) / view.scale;

      ctx.save();
      ctx.translate(centerX, centerY);
      drawBranch(ctx, baseLength, Math.min(growth, MAX_DEPTH), preset, isDark);
      ctx.restore();
    }
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    FibonacciTree: {
      id: "FibonacciTree",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "Fₙ = Fₙ₋₁ + Fₙ₋₂",
      // explanationUrl: "explanations/fibonacci_tree.html",
    },
  };
})(window);
