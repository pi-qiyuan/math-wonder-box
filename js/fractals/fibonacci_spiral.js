(function registerFibonacciSpiral(global) {
  const PHI = (1 + Math.sqrt(5)) / 2;
  const MAX_STEPS = 42;
  const GROWTH_SPEED = 0.008; // Steps per frame (half of previous 0.016)
  const PAUSE_DURATION = 180; // Frames to pause at max growth (approx 3 seconds)

  const PRESETS = [
    { id: "nautilus-shell",   nameKey: "fibonacci_preset_shell",   lineColor: "pearl",  fillMode: "shell",    shapeMode: "sector", animate: true  },
    { id: "classic-nautilus", nameKey: "fibonacci_preset_classic", lineColor: "golden", fillMode: "none",     shapeMode: "square", animate: true  },
    { id: "rainbow-squares",  nameKey: "fibonacci_preset_rainbow", lineColor: "white",  fillMode: "rainbow",  shapeMode: "square", animate: true  },
    { id: "monochrome-depth", nameKey: "fibonacci_preset_depth",   lineColor: "gray",   fillMode: "gradient", shapeMode: "square", animate: false }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let growthCounter = 1;
  let pauseTimer = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0, scale: 1.5 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    growthCounter = 1;
    pauseTimer = 0;
    return calculateOptimalView(canvas);
  }

  function getFibonacci(n) {
    return Math.round((Math.pow(PHI, n) - Math.pow(1 - PHI, n)) / Math.sqrt(5));
  }

  function drawSpiral(ctx, width, height, view, isDark, currentSteps) {
    const preset = PRESETS[currentPresetIndex];
    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const baseSize = (Math.min(width, height) / 10) / view.scale;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    
    if (preset.animate) {
        ctx.rotate(time * 0.1);
    }

    let currentX = 0, currentY = 0;
    let dir = 0;
    
    const floorSteps = Math.floor(currentSteps);
    const partialStep = currentSteps - floorSteps;

    for (let i = 1; i <= floorSteps; i++) {
        const side = getFibonacci(i) * baseSize;
        drawStep(ctx, currentX, currentY, dir, side, i, preset, isDark, 1.0, time);

        // Move to next starting point
        if (dir === 0) { currentX += side; currentY += side; }
        else if (dir === 1) { currentX -= side; currentY += side; }
        else if (dir === 2) { currentX -= side; currentY -= side; }
        else if (dir === 3) { currentX += side; currentY -= side; }
        
        dir = (dir + 1) % 4;
    }

    // Draw the partial step
    if (floorSteps < MAX_STEPS && partialStep > 0) {
        const side = getFibonacci(floorSteps + 1) * baseSize;
        drawStep(ctx, currentX, currentY, dir, side, floorSteps + 1, preset, isDark, partialStep, time);
    }

    ctx.restore();
  }

  function drawStep(ctx, x, y, dir, side, index, preset, isDark, alpha, time) {
    const shapeMode = preset.shapeMode || "square";

    // Setup Colors
    let fillStyle = "transparent";
    if (preset.fillMode === "rainbow") {
        fillStyle = `hsla(${(index * 30 + time * 20) % 360}, 70%, 50%, ${0.3 * alpha})`;
    } else if (preset.fillMode === "gradient") {
        const lit = isDark ? 20 + (index % 20) * 3 : 90 - (index % 20) * 3;
        fillStyle = `hsla(200, 30%, ${lit}%, ${alpha})`;
    } else if (preset.fillMode === "shell") {
        const baseHue = isDark ? 30 : 40;
        const sat = isDark ? 20 : 30;
        const lit = isDark ? 15 + (index % 10) * 2 : 95 - (index % 10) * 2;
        fillStyle = `hsla(${baseHue}, ${sat}%, ${lit}%, ${alpha})`;
    }

    const strokeBase = isDark ? "255,255,255" : "0,0,0";
    let strokeStyle = `rgba(${strokeBase}, ${0.5 * alpha})`;
    if (preset.lineColor === "golden") strokeStyle = `rgba(212, 175, 55, ${alpha})`;
    if (preset.lineColor === "pearl") {
        const l = isDark ? 80 : 40;
        strokeStyle = `hsla(30, 20%, ${l}%, ${alpha})`;
    }

    // Synchronized Arc/Sector Parameters for Connectivity
    let centerX, centerY, startAngle;
    if (dir === 0) {
        centerX = x; centerY = y + side; startAngle = 1.5 * Math.PI;
    } else if (dir === 1) {
        centerX = x - side; centerY = y; startAngle = 0;
    } else if (dir === 2) {
        centerX = x; centerY = y - side; startAngle = 0.5 * Math.PI;
    } else {
        centerX = x + side; centerY = y; startAngle = Math.PI;
    }
    const endAngle = startAngle + 0.5 * Math.PI;

    if (shapeMode === "square") {
        const width = (dir === 1 || dir === 2 ? -side : side);
        const height = (dir === 2 || dir === 3 ? -side : side);

        if (preset.fillMode !== "none") {
            ctx.fillStyle = fillStyle;
            ctx.fillRect(x, y, width, height);
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    } else {
        // Sector mode (for Nautilus)
        if (preset.fillMode !== "none") {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, side, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
            
            // Chamber wall line (radial)
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + side * Math.cos(startAngle), centerY + side * Math.sin(startAngle));
            ctx.stroke();
        }
    }
    
    // Always draw the main spiral arc (continuous curve)
    ctx.beginPath();
    ctx.lineWidth = preset.fillMode === "shell" ? 3 : 2;
    ctx.strokeStyle = strokeStyle;
    ctx.arc(centerX, centerY, side, startAngle, endAngle);
    ctx.stroke();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    time += 0.02;
    
    if (growthCounter < MAX_STEPS) {
        growthCounter += GROWTH_SPEED;
        if (growthCounter >= MAX_STEPS) {
            growthCounter = MAX_STEPS;
            pauseTimer = PAUSE_DURATION;
        }
    } else {
        if (pauseTimer > 0) {
            pauseTimer--;
        } else {
            growthCounter = 1;
            // Reset view to default state when restarting growth
            const defaultView = calculateOptimalView(canvas);
            view.centerX = defaultView.centerX;
            view.centerY = defaultView.centerY;
            view.scale = defaultView.scale;
        }
    }

    drawSpiral(ctx, canvas.width, canvas.height, view, isDark, growthCounter);
    
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
        drawSpiral(ctx, canvas.width, canvas.height, view, isDark, growthCounter);
    }
  }

  function reset() {
    growthCounter = 1;
    time = 0;
    pauseTimer = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Fibonacci: {
      id: "Fibonacci",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "Fₙ = Fₙ₋₁ + Fₙ₋₂",
      explanationUrl: "/tools/math-wonder-box/fibonacci-spiral.html",
    },
  };
})(window);
