(function registerFibonacciTree(global) {
  const GROW_SPEED = 0.025;

  const PRESETS = [
    { id: "classic-tree",  nameKey: "fibonacci_tree_preset_classic",  r1: 0.72, r2: 0.72, angle1: -Math.PI / 8,    angle2: Math.PI / 8,   branchColor: "nature",   maxDepth: 14 },
    { id: "winter-tree",   nameKey: "fibonacci_tree_preset_winter",   r1: 0.8,  r2: 0.5,  angle1: -Math.PI / 15,   angle2: Math.PI / 3.5, branchColor: "gray",     maxDepth: 14 },
    { id: "sakura-tree",   nameKey: "fibonacci_tree_preset_sakura",   r1: 0.75, r2: 0.75, angle1: -Math.PI / 4,    angle2: Math.PI / 4,   branchColor: "sakura",   maxDepth: 14 },
    { id: "coral-tree",    nameKey: "fibonacci_tree_preset_coral",    r1: 0.85, r2: 0.4,  angle1: -Math.PI / 10,   angle2: Math.PI / 2.5, branchColor: "coral",    maxDepth: 14 },
    { id: "autumn-tree",   nameKey: "fibonacci_tree_preset_autumn",   r1: 0.8,  r2: 0.8,  angle1: -Math.PI / 12,   angle2: Math.PI / 12,  branchColor: "autumn",   maxDepth: 14 },
    { id: "neon-tree",     nameKey: "fibonacci_tree_preset_neon",     r1: 0.78, r2: 0.78, angle1: -Math.PI / 6,    angle2: Math.PI / 6,   branchColor: "neon",     maxDepth: 14 },
    { id: "bonsai-tree",   nameKey: "fibonacci_tree_preset_bonsai",   r1: 0.88, r2: 0.88, angle1: -Math.PI / 24,   angle2: Math.PI / 24,  branchColor: "bonsai",   maxDepth: 14 },
    { id: "midnight-tree", nameKey: "fibonacci_tree_preset_midnight", r1: 0.7,  r2: 0.65, angle1: -Math.PI / 3,    angle2: Math.PI / 6,   branchColor: "midnight", maxDepth: 14 },
    { id: "ocean-tree",    nameKey: "fibonacci_tree_preset_ocean",    r1: 0.75, r2: 0.55, angle1: -Math.PI / 6,    angle2: -Math.PI / 18, branchColor: "ocean",    maxDepth: 14 },
    { id: "emerald-tree",  nameKey: "fibonacci_tree_preset_emerald",  r1: 0.7,  r2: 0.65, angle1: -Math.PI / 2.25, angle2: Math.PI / 9,   branchColor: "emerald",  maxDepth: 14 },
    { id: "frost-tree",    nameKey: "fibonacci_tree_preset_frost",    r1: 0.71, r2: 0.71, angle1: -Math.PI / 2.5,  angle2: Math.PI / 2.5, branchColor: "frost",    maxDepth: 14 },
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

  // A Fibonacci tree is not a full binary tree: its two descendants have
  // consecutive Fibonacci orders, T(n - 1) and T(n - 2).
  function drawBranch(ctx, length, order, preset, isDark, turn = 1) {
    // T(0) and T(1) are terminal vertices; every higher order splits into
    // T(n - 1) and T(n - 2).
    if (order < 0) return;

    const opacity = 1;
    const scale = 1;

    ctx.save();
    ctx.globalAlpha *= opacity;

    // Draw current branch
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -length * scale);
    ctx.lineWidth = Math.max(0.5, order * 0.8);
    ctx.lineCap = "round";
    
    // Color logic
    const colorDepth = order / preset.maxDepth;
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

    if (order > 1) {
      // Dynamic sway
      const sway = Math.sin(time + order * 0.5) * 0.03;

      // The n - 1 branch is the continuing stem. Alternating the turn keeps
      // the tree balanced while the smaller n - 2 branch reads as a lateral.
      ctx.save();
      ctx.rotate(preset.angle1 * turn + sway);
      drawBranch(ctx, length * preset.r1, order - 1, preset, isDark, -turn);
      ctx.restore();

      // This shorter subtree is what distinguishes the Fibonacci recurrence
      // from an ordinary symmetric binary fractal.
      ctx.save();
      ctx.rotate(preset.angle2 * turn - sway);
      drawBranch(ctx, length * preset.r2, order - 2, preset, isDark, turn);
      ctx.restore();
    }
    
    ctx.restore();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const preset = PRESETS[currentPresetIndex];
    const maxDepth = preset.maxDepth;
    time += 0.015;
    if (growth < maxDepth) {
      growth += GROW_SPEED;
    } else {
        pauseTimer += 1;
        if (pauseTimer > 60 * 10) { // 5 seconds at ~60fps
            reset();
        }
    }

    const width = canvas.width;
    const height = canvas.height;
    
    // Position at bottom center
    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height * 0.8 - (view.centerY * height / view.scale);
    const baseLength = (height / 5) / view.scale;

    ctx.save();
    ctx.translate(centerX, centerY);
    drawBranch(ctx, baseLength, Math.max(1, Math.floor(Math.min(growth, maxDepth))), preset, isDark);
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

      const maxDepth = preset.maxDepth;
      drawBranch(ctx, baseLength, Math.max(1, Math.floor(Math.min(growth, maxDepth))), preset, isDark);
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
      explanationUrl: "/tools/math-wonder-box/fibonacci-tree.html",
    },
  };
})(window);
