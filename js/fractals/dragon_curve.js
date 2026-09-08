(function registerDragonCurve(global) {
  const PRESETS = [
    { id: "classic_emerald", nameKey: "dragon_preset_classic_emerald", iterations: 14, driftSpeed: 0.6, colorType: "emerald",     },
    { id: "golden_dragon",   nameKey: "dragon_preset_golden_dragon",   iterations: 13, driftSpeed: 0.5, colorType: "gold-purple", },
    { id: "nebula_growth",   nameKey: "dragon_preset_nebula_growth",   iterations: 15, driftSpeed: 0.4, colorType: "nebula",      },
    { id: "rainbow_tail",    nameKey: "dragon_preset_rainbow_tail",    iterations: 14, driftSpeed: 0.7, colorType: "rainbow",     },
    { id: "violet_phantom",  nameKey: "dragon_preset_violet_phantom",  iterations: 16, driftSpeed: 0.3, colorType: "violet",      },
    { id: "fire_serpent",    nameKey: "dragon_preset_fire_serpent",    iterations: 14, driftSpeed: 0.5, colorType: "fire",        }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    // The dragon curve expands asymetrically, so we shift it to center its mass
    return { centerX: 0.3, centerY: -0.1, scale: 3.5 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // Cache the generated sequence per preset so we don't regenerate
  // a (potentially 65k-element) array every single animation frame.
  let cachedSequence = null;
  let cachedSequencePresetIndex = -1;

  function getCachedSequence(preset, presetIndex) {
    if (cachedSequence === null || cachedSequencePresetIndex !== presetIndex) {
      cachedSequence = getDragonSequence(preset.iterations);
      cachedSequencePresetIndex = presetIndex;
    }
    return cachedSequence;
  }

  // Cache the dragon curve's point positions in *local* (unrotated, unscaled,
  // unit-step) coordinates. These only depend on the turn sequence, not on
  // time/rotation/zoom, so they're computed once per preset instead of every
  // single animation frame.
  let cachedLocalPoints = null;
  let cachedLocalPointsPresetIndex = -1;

  function getCachedLocalPoints(sequence, presetIndex) {
    if (cachedLocalPoints === null || cachedLocalPointsPresetIndex !== presetIndex) {
      const points = new Float64Array((sequence.length + 1) * 2);
      let lx = 0, ly = 0, localAngle = 0;
      points[0] = 0;
      points[1] = 0;
      for (let i = 0; i < sequence.length; i++) {
        lx += Math.cos(localAngle);
        ly += Math.sin(localAngle);
        points[(i + 1) * 2] = lx;
        points[(i + 1) * 2 + 1] = ly;
        localAngle += (sequence[i] * Math.PI) / 2;
      }
      cachedLocalPoints = points;
      cachedLocalPointsPresetIndex = presetIndex;
    }
    return cachedLocalPoints;
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    
    // Clear canvas
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    time = 0;
    return calculateOptimalView(canvas);
  }

  // Generate the dragon curve sequence (turns: 1 for right, -1 for left)
  function getDragonSequence(n) {
    let sequence = [1];
    for (let i = 1; i < n; i++) {
      let copy = [...sequence].reverse().map(x => -x);
      sequence = [...sequence, 1, ...copy];
    }
    return sequence;
  }

  function drawDragonScene(ctx, width, height, centerX, centerY, size, preset, presetIndex, time, isDark, subsampling) {
    const sequence = getCachedSequence(preset, presetIndex);
    
    // Animate the drawing progress based on time.
    // progress goes 0 -> 1 -> 0 ... (starts at 0, fully retracts at 0)
    const totalSegments = sequence.length;
    const progress = 0.5 - 0.5 * Math.cos(time * 0.5);
    const drawLimit = Math.min(totalSegments, Math.floor(totalSegments * progress));
    
    // Starting orientation
    const angle = time * 0.1; // Slow overall rotation
    const cosR = Math.cos(angle);
    const sinR = Math.sin(angle);

    // Base segment length - scales with iteration count to keep it on screen
    const stepSize = (size * 1.5) / Math.pow(Math.sqrt(2), preset.iterations);

    // Precomputed unrotated points for this preset (only depends on the turn
    // sequence, never on time), so per-frame cost is one rotation per point
    // instead of recomputing the whole turtle walk with trig every frame.
    const localPoints = getCachedLocalPoints(sequence, presetIndex);

    let x = centerX;
    let y = centerY;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let i = 1; i <= drawLimit; i++) {
      const lx = localPoints[i * 2];
      const ly = localPoints[i * 2 + 1];
      x = centerX + stepSize * (lx * cosR - ly * sinR);
      y = centerY + stepSize * (lx * sinR + ly * cosR);
      ctx.lineTo(x, y);
    }

    // Gradient or dynamic color
    const grad = ctx.createLinearGradient(centerX, centerY, x, y);
    if (preset.colorType === "rainbow") {
      for (let j = 0; j <= 5; j++) {
        const f = j / 5;
        const hue = (f * 360 + time * 40) % 360;
        grad.addColorStop(f, `hsla(${hue}, 85%, ${isDark ? 65 : 45}%, 0.8)`);
      }
    } else if (preset.colorType === "emerald") {
      grad.addColorStop(0, `hsla(150, 80%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(1, `hsla(180, 90%, ${isDark ? 50 : 30}%, 0.8)`);
    } else if (preset.colorType === "gold-purple") {
      grad.addColorStop(0, `hsla(45, 95%, ${isDark ? 65 : 45}%, 0.8)`);
      grad.addColorStop(1, `hsla(280, 80%, ${isDark ? 55 : 35}%, 0.8)`);
    } else if (preset.colorType === "nebula") {
      grad.addColorStop(0, `hsla(300, 90%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(1, `hsla(220, 90%, ${isDark ? 50 : 35}%, 0.8)`);
    } else if (preset.colorType === "fire") {
      grad.addColorStop(0, `hsla(50, 95%, ${isDark ? 75 : 55}%, 0.8)`);
      grad.addColorStop(1, `hsla(10, 95%, ${isDark ? 55 : 35}%, 0.8)`);
    } else if (preset.colorType === "violet") {
      grad.addColorStop(0, `hsla(260, 80%, ${isDark ? 75 : 55}%, 0.8)`);
      grad.addColorStop(1, `hsla(290, 80%, ${isDark ? 55 : 35}%, 0.8)`);
    }

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = subsampling === 1 ? 2.5 : 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    
    // Bloom effect for high iterations.
    // Note: ctx.shadowBlur on a path with tens of thousands of segments is
    // expensive to rasterize every frame and can itself cause stutter/flicker
    // at high iteration presets. Lowered from 10 -> 4; set to 0 to disable
    // entirely if you still see jank on the 14-16 iteration presets.
    if (subsampling === 1) {
      ctx.shadowBlur = 4;
      ctx.shadowColor = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)";
    }
    
    ctx.stroke();
    ctx.restore();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

    drawDragonScene(ctx, width, height, centerX, centerY, size, preset, currentPresetIndex, time, isDark, 1);

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (subsampling === 1) {
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, width, height);

      drawDragonScene(ctx, width, height, centerX, centerY, size, preset, currentPresetIndex, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    DragonCurve: {
      id: "DragonCurve",
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
      explanationUrl: "/tools/math-wonder-box/dragon-curve.html",
    },
  };
})(window);
