(function registerRoseCurve(global) {
  const PRESETS = [
    { id: "trifolium",        nameKey: "rose_preset_trifolium",        type: "classic", k: 3,                         driftSpeed: 0.8, colorType: "rainbow",     formula: "r = cos(3θ)"          },
    { id: "quadrifolium",     nameKey: "rose_preset_quadrifolium",     type: "classic", k: 2,                         driftSpeed: 0.6, colorType: "cyan-blue",   formula: "r = cos(2θ)"          },
    { id: "mystic_rosette",   nameKey: "rose_preset_mystic_rosette",   type: "maurer",  n: 6,                  d: 71, driftSpeed: 0.4, colorType: "gold-purple", formula: "r = sin(6θ), d = 71°" },
    { id: "cosmic_star",      nameKey: "rose_preset_cosmic_star",      type: "maurer",  n: 5,                  d: 97, driftSpeed: 0.3, colorType: "nebula",      formula: "r = sin(5θ), d = 97°" },
    { id: "butterfly_rose",   nameKey: "rose_preset_butterfly_rose",   type: "maurer",  n: 2,                  d: 39, driftSpeed: 0.5, colorType: "emerald",     formula: "r = sin(2θ), d = 39°" },
    { id: "fire_dahlia",      nameKey: "rose_preset_fire_dahlia",      type: "maurer",  n: 7,                  d: 29, driftSpeed: 0.4, colorType: "fire",        formula: "r = sin(7θ), d = 29°" },
    { id: "interlaced_bloom", nameKey: "rose_preset_interlaced_bloom", type: "classic", k: 1.75, period: 8 * Math.PI, driftSpeed: 0.5, colorType: "pink-orange", formula: "r = cos(1.75θ)"       },
    { id: "lace_flower",      nameKey: "rose_preset_lace_flower",      type: "classic", k: 1.8,  period: 5 * Math.PI, driftSpeed: 0.4, colorType: "violet",      formula: "r = cos(1.8θ)"        }
  ];

  // ── Tunable constants for the discrete-trace effects ──────────────────────
  const TRACE_STEP_DEG   = 10;                          // degrees between each ghost mark
  const TRACE_STEP_RAD   = TRACE_STEP_DEG * Math.PI / 180;
  const TRACE_FADE_RATE  = 0.985;                       // opacity multiplier per frame (lower = faster fade)
  const TRACE_MIN_OPACITY = 0.02;                       // ghost is removed below this opacity
  const TRACE_HEAD_OPACITY = 0.8;                       // opacity of the continuously-moving head
  const HOLD_DURATION_MS = 5000;                        // ms the flower holds still before fading (effect 2)
  const HOLD_FADE_RATE   = 0.992;                       // opacity multiplier per frame during fade-out (effect 2)
  // Rotation angle at which the flower stops, per preset id (effect 2)
  const HOLD_STOP_ANGLE  = { trifolium: 360, quadrifolium: 180 }; // degrees of phi
  // Effect 3: comet-tail sector behind the moving head
  const TAIL_LENGTH_DEG  = 60;                          // how many degrees of arc the tail spans at full length
  const TAIL_STEPS       = 40;                          // number of tiles between adjacent phi samples
  const TAIL_COLOR_DARK  = "180, 180, 180";             // RGB of tail in dark mode
  const TAIL_COLOR_LIGHT = "80, 80, 80";                // RGB of tail in light mode
  const TAIL_MAX_OPACITY = 0.55;                        // opacity at the tip (closest to head)
  // ───────────────────────────────────────────────────────────────────────────

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  // Which effect is active for trifolium / quadrifolium (chosen randomly on each draw/randomize)
  // 1 = continuous drift with fading ghost marks (every 10°)
  // 2 = rotate to stop-angle → hold → all fade together → restart
  // 3 = comet-tail gradient sector behind the head
  // 4 = original: simple continuous rotation, no traces
  let discreteEffect = 1;

  // Effect 1 state
  let roseTraces = [];
  let lastStepIndex = -1;

  // Effect 2 state
  let mode2Phase = 'rotating';   // 'rotating' | 'holding' | 'fading'
  let mode2HoldStart = 0;        // performance.now() when hold began
  let mode2Opacity = TRACE_HEAD_OPACITY; // current opacity during hold/fade

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0, scale: 2.5 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    roseTraces    = [];
    lastStepIndex = -1;
    mode2Phase    = 'rotating';
    mode2Opacity  = TRACE_HEAD_OPACITY;
  }

  function resetDiscreteState() {
    roseTraces     = [];
    lastStepIndex  = -1;
    discreteEffect = Math.floor(Math.random() * 4) + 1;  // 1, 2, 3, or 4
    mode2Phase     = 'rotating';
    mode2HoldStart = 0;
    mode2Opacity   = TRACE_HEAD_OPACITY;
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    time = 0;
    resetDiscreteState();

    // Force a full clear on randomize for a clean transition
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return calculateOptimalView(canvas);
  }

  function getColor(colorType, factor, time, isDark) {
    let hue;
    if (colorType === "rainbow") {
      hue = (factor * 360 + time * 30) % 360;
      return `hsla(${hue}, 85%, ${isDark ? 65 : 45}%, 0.8)`;
    } else if (colorType === "cyan-blue") {
      hue = 180 + factor * 60 + Math.sin(time) * 15;
      return `hsla(${hue}, 80%, ${isDark ? 60 : 45}%, 0.8)`;
    } else if (colorType === "pink-orange") {
      hue = 320 + factor * 60 + Math.sin(time) * 15;
      return `hsla(${hue}, 85%, ${isDark ? 65 : 50}%, 0.8)`;
    } else if (colorType === "violet") {
      hue = 250 + factor * 50 + Math.sin(time) * 10;
      return `hsla(${hue}, 80%, ${isDark ? 70 : 50}%, 0.8)`;
    }
    return isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)";
  }

  function getGridGradient(ctx, colorType, centerX, centerY, size, isDark) {
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
    if (colorType === "gold-purple") {
      if (isDark) {
        grad.addColorStop(0, "rgba(255, 215, 0, 0.1)");
        grad.addColorStop(0.6, "rgba(186, 85, 211, 0.2)");
        grad.addColorStop(1, "rgba(128, 0, 128, 0.35)");
      } else {
        grad.addColorStop(0, "rgba(218, 165, 32, 0.2)");
        grad.addColorStop(0.6, "rgba(147, 112, 219, 0.3)");
        grad.addColorStop(1, "rgba(75, 0, 130, 0.45)");
      }
    } else if (colorType === "nebula") {
      if (isDark) {
        grad.addColorStop(0, "rgba(255, 105, 180, 0.1)");
        grad.addColorStop(0.5, "rgba(138, 43, 226, 0.2)");
        grad.addColorStop(1, "rgba(0, 0, 255, 0.35)");
      } else {
        grad.addColorStop(0, "rgba(219, 112, 147, 0.2)");
        grad.addColorStop(0.5, "rgba(102, 51, 153, 0.3)");
        grad.addColorStop(1, "rgba(70, 130, 180, 0.45)");
      }
    } else if (colorType === "emerald") {
      if (isDark) {
        grad.addColorStop(0, "rgba(127, 255, 212, 0.1)");
        grad.addColorStop(0.6, "rgba(60, 179, 113, 0.2)");
        grad.addColorStop(1, "rgba(0, 100, 80, 0.35)");
      } else {
        grad.addColorStop(0, "rgba(72, 209, 204, 0.2)");
        grad.addColorStop(0.6, "rgba(46, 139, 87, 0.3)");
        grad.addColorStop(1, "rgba(0, 128, 128, 0.45)");
      }
    } else if (colorType === "fire") {
      if (isDark) {
        grad.addColorStop(0, "rgba(255, 255, 0, 0.15)");
        grad.addColorStop(0.5, "rgba(255, 140, 0, 0.25)");
        grad.addColorStop(1, "rgba(255, 0, 0, 0.35)");
      } else {
        grad.addColorStop(0, "rgba(255, 215, 0, 0.25)");
        grad.addColorStop(0.5, "rgba(255, 69, 0, 0.35)");
        grad.addColorStop(1, "rgba(139, 0, 0, 0.45)");
      }
    } else {
      if (isDark) {
        grad.addColorStop(0, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0.2)");
      } else {
        grad.addColorStop(0, "rgba(0, 0, 0, 0.05)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0.2)");
      }
    }
    return grad;
  }

  function getBoundaryGradient(ctx, colorType, centerX, centerY, size, isDark, time) {
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
    if (colorType === "gold-purple") {
      grad.addColorStop(0, `hsla(${(45 + Math.sin(time) * 10) % 360}, 95%, ${isDark ? 65 : 45}%, 0.9)`);
      grad.addColorStop(1, `hsla(${(280 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 60 : 40}%, 0.9)`);
    } else if (colorType === "nebula") {
      grad.addColorStop(0, `hsla(${(320 + Math.sin(time) * 15) % 360}, 95%, ${isDark ? 70 : 50}%, 0.9)`);
      grad.addColorStop(1, `hsla(${(240 + Math.sin(time) * 10) % 360}, 90%, ${isDark ? 60 : 40}%, 0.9)`);
    } else if (colorType === "emerald") {
      grad.addColorStop(0, `hsla(${(160 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 65 : 45}%, 0.9)`);
      grad.addColorStop(1, `hsla(${(120 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 55 : 35}%, 0.9)`);
    } else if (colorType === "fire") {
      grad.addColorStop(0, `hsla(${(50 + Math.sin(time * 2) * 5) % 360}, 95%, ${isDark ? 70 : 50}%, 0.9)`);
      grad.addColorStop(1, `hsla(${(10 + Math.sin(time * 2) * 5) % 360}, 95%, ${isDark ? 55 : 40}%, 0.9)`);
    } else {
      grad.addColorStop(0, isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.8)");
      grad.addColorStop(1, isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)");
    }
    return grad;
  }

  function drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling, alpha = 1.0) {
    if (preset.type === "classic") {
      // Classic Rose Curves
      const k = preset.k;
      const period = preset.period || (2 * Math.PI);
      const quality = 600;
      const phi = time * preset.driftSpeed;

      // Draw glow layer
      ctx.beginPath();
      for (let i = 0; i <= quality; i++) {
        const theta = (i * period) / quality;
        const r = size * Math.cos(k * theta + phi);
        const x = r * Math.cos(theta) + centerX;
        const y = r * Math.sin(theta) + centerY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
      if (preset.colorType === "rainbow") {
        for (let j = 0; j <= 5; j++) {
          const f = j / 5;
          const hue = (f * 360 + time * 25) % 360;
          grad.addColorStop(f, `hsla(${hue}, 85%, ${isDark ? 65 : 45}%, 0.8)`);
        }
      } else if (preset.colorType === "cyan-blue") {
        grad.addColorStop(0, `hsla(${(180 + Math.sin(time) * 15) % 360}, 80%, ${isDark ? 65 : 45}%, 0.8)`);
        grad.addColorStop(0.5, `hsla(${(210 + Math.sin(time) * 10) % 360}, 80%, ${isDark ? 60 : 40}%, 0.8)`);
        grad.addColorStop(1, `hsla(${(240 + Math.sin(time) * 15) % 360}, 80%, ${isDark ? 55 : 35}%, 0.8)`);
      } else if (preset.colorType === "pink-orange") {
        grad.addColorStop(0, `hsla(${(320 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 70 : 50}%, 0.8)`);
        grad.addColorStop(0.5, `hsla(${(350 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 65 : 45}%, 0.8)`);
        grad.addColorStop(1, `hsla(${(20 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 60 : 40}%, 0.8)`);
      } else if (preset.colorType === "violet") {
        grad.addColorStop(0, `hsla(${(250 + Math.sin(time) * 10) % 360}, 80%, ${isDark ? 75 : 55}%, 0.8)`);
        grad.addColorStop(0.5, `hsla(${(270 + Math.sin(time) * 10) % 360}, 80%, ${isDark ? 65 : 45}%, 0.8)`);
        grad.addColorStop(1, `hsla(${(290 + Math.sin(time) * 10) % 360}, 80%, ${isDark ? 55 : 35}%, 0.8)`);
      }

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = subsampling === 1 ? 6 : 4;
      ctx.globalAlpha = 0.25 * alpha;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = subsampling === 1 ? 2.5 : 1.8;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();

    } else if (preset.type === "maurer") {
      // Maurer Rose
      const n = preset.n;
      const d = preset.d;
      const phi = time * preset.driftSpeed;

      // 1. Draw Maurer Rose web lattice
      ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const rad = (i * d * Math.PI) / 180;
        const r = size * Math.sin(n * rad + phi);
        const x = r * Math.cos(rad) + centerX;
        const y = r * Math.sin(rad) + centerY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.save();
      ctx.strokeStyle = getGridGradient(ctx, preset.colorType, centerX, centerY, size, isDark);
      ctx.lineWidth = subsampling === 1 ? 1.0 : 0.8;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();

      // 2. Draw boundary Rose Curve on top
      ctx.beginPath();
      const boundaryQuality = subsampling === 1 ? 360 : 200;
      for (let j = 0; j <= boundaryQuality; j++) {
        const theta = (j * 2 * Math.PI) / boundaryQuality;
        const r = size * Math.sin(n * theta + phi);
        const x = r * Math.cos(theta) + centerX;
        const y = r * Math.sin(theta) + centerY;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      
      const boundGrad = getBoundaryGradient(ctx, preset.colorType, centerX, centerY, size, isDark, time);
      
      ctx.save();
      ctx.strokeStyle = boundGrad;
      ctx.lineWidth = subsampling === 1 ? 5 : 3.5;
      ctx.globalAlpha = 0.25 * alpha;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = boundGrad;
      ctx.lineWidth = subsampling === 1 ? 2.0 : 1.5;
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    const preset = PRESETS[currentPresetIndex];
    const useDiscreteTraces = preset.id === "trifolium" || preset.id === "quadrifolium";

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

    if (useDiscreteTraces) {
      if (discreteEffect === 1) {
        // ── Effect 1: continuous drift with fading ghost marks ──────────────
        const phi = time * preset.driftSpeed;
        const stepIndex = Math.floor(phi / TRACE_STEP_RAD);

        if (stepIndex > lastStepIndex) {
          roseTraces.push({ step: stepIndex, phi: stepIndex * TRACE_STEP_RAD, opacity: TRACE_HEAD_OPACITY });
          lastStepIndex = stepIndex;
        }

        // Only fade marks the head has already left
        roseTraces.forEach(t => {
          if (t.step < stepIndex) t.opacity *= TRACE_FADE_RATE;
        });
        roseTraces = roseTraces.filter(t => t.opacity > TRACE_MIN_OPACITY);

        ctx.fillStyle = isDark ? "#121212" : "#ffffff";
        ctx.fillRect(0, 0, width, height);

        roseTraces.forEach(t => {
          drawRoseScene(ctx, width, height, centerX, centerY, size, preset, t.phi / preset.driftSpeed, isDark, 1, t.opacity);
        });

        // Continuously moving head
        drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1, TRACE_HEAD_OPACITY);

      } else if (discreteEffect === 3) {
        // ── Effect 3: comet-tail — seamless gradient fill using closed polygon tiles ──
        // Each tile is the closed region between two adjacent rose-curve outlines at
        // slightly different phi values. Filling tiles eliminates stripe artifacts.
        const phi = time * preset.driftSpeed;
        const color = isDark ? TAIL_COLOR_DARK : TAIL_COLOR_LIGHT;

        ctx.fillStyle = isDark ? "#121212" : "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const tailRad    = TAIL_LENGTH_DEG * Math.PI / 180;
        const actualTail = Math.min(phi, tailRad); // grows from 0 as the flower rotates
        if (actualTail > 0) {
          const tileRad = actualTail / TAIL_STEPS;
          const quality = 120; // points per rose curve sample
          const period  = preset.period || (2 * Math.PI);

          // Pre-sample rose curve points at each phi step
          // pts[i] = array of {x,y} for phi = phi - actualTail + i * tileRad
          const pts = [];
          for (let i = 0; i <= TAIL_STEPS; i++) {
            const slicePhi = phi - actualTail + i * tileRad;
            const curve = [];
            for (let j = 0; j <= quality; j++) {
              const theta = (j * period) / quality;
              const r = size * Math.cos(preset.k * theta + slicePhi);
              curve.push({
                x: r * Math.cos(theta) + centerX,
                y: r * Math.sin(theta) + centerY,
              });
            }
            pts.push(curve);
          }

          // Draw tiles: each tile is bounded by pts[i] (forward) and pts[i+1] (backward)
          // alpha ramps from 0 at the tail end to TAIL_MAX_OPACITY just behind the head
          for (let i = 0; i < TAIL_STEPS; i++) {
            const tFar  = i       / TAIL_STEPS; // 0 at tail end
            const tNear = (i + 1) / TAIL_STEPS; // 1 at head
            const alphaFar  = TAIL_MAX_OPACITY * tFar;
            const alphaNear = TAIL_MAX_OPACITY * tNear;

            // Build closed path: pts[i] forward, then pts[i+1] backward
            ctx.beginPath();
            pts[i].forEach((p, j) => j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            for (let j = pts[i + 1].length - 1; j >= 0; j--) {
              ctx.lineTo(pts[i + 1][j].x, pts[i + 1][j].y);
            }
            ctx.closePath();

            // Use a linear gradient across the tile from alphaFar to alphaNear.
            // Gradient direction: from centroid of pts[i] to centroid of pts[i+1].
            // A simple approximation: use the midpoint of first points on each curve.
            const x0 = pts[i][0].x,       y0 = pts[i][0].y;
            const x1 = pts[i + 1][0].x,   y1 = pts[i + 1][0].y;
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, `rgba(${color}, ${alphaFar})`);
            grad.addColorStop(1, `rgba(${color}, ${alphaNear})`);

            ctx.fillStyle = grad;
            ctx.fill();
          }
        }

        // Draw the colored head on top
        drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1, TRACE_HEAD_OPACITY);

      } else if (discreteEffect == 2) {
        // ── Effect 2: rotate → stamp ghosts (no fade) → hold 5s → all fade together → restart
        const stopDeg  = HOLD_STOP_ANGLE[preset.id] || 60;
        const stopPhi  = stopDeg * Math.PI / 180;
        const now      = performance.now();

        if (mode2Phase === 'rotating') {
          const phi = time * preset.driftSpeed;
          const stepIndex = Math.floor(phi / TRACE_STEP_RAD);

          // Stamp ghost at each 10-degree step — no fading during rotation
          if (stepIndex > lastStepIndex) {
            roseTraces.push({ step: stepIndex, phi: stepIndex * TRACE_STEP_RAD, opacity: TRACE_HEAD_OPACITY });
            lastStepIndex = stepIndex;
          }

          ctx.fillStyle = isDark ? "#121212" : "#ffffff";
          ctx.fillRect(0, 0, width, height);

          // Draw all accumulated ghosts at full opacity
          roseTraces.forEach(t => {
            drawRoseScene(ctx, width, height, centerX, centerY, size, preset, t.phi / preset.driftSpeed, isDark, 1, t.opacity);
          });

          // Draw moving head on top
          drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1, TRACE_HEAD_OPACITY);

          if (phi >= stopPhi) {
            mode2Phase     = 'holding';
            mode2HoldStart = now;
          }

        } else if (mode2Phase === 'holding') {
          ctx.fillStyle = isDark ? "#121212" : "#ffffff";
          ctx.fillRect(0, 0, width, height);
          roseTraces.forEach(t => {
            drawRoseScene(ctx, width, height, centerX, centerY, size, preset, t.phi / preset.driftSpeed, isDark, 1, t.opacity);
          });
          if (now - mode2HoldStart >= HOLD_DURATION_MS) {
            mode2Phase = 'fading';
          }

        } else {
          // 'fading' — all ghosts fade together
          roseTraces.forEach(t => { t.opacity *= HOLD_FADE_RATE; });
          ctx.fillStyle = isDark ? "#121212" : "#ffffff";
          ctx.fillRect(0, 0, width, height);
          roseTraces = roseTraces.filter(t => t.opacity > TRACE_MIN_OPACITY);
          roseTraces.forEach(t => {
            drawRoseScene(ctx, width, height, centerX, centerY, size, preset, t.phi / preset.driftSpeed, isDark, 1, t.opacity);
          });
          if (roseTraces.length === 0) {
            // All gone — restart
            time          = 0;
            lastStepIndex = -1;
            mode2Phase    = 'rotating';
            mode2Opacity  = TRACE_HEAD_OPACITY;
          }
        }
      } else {
        // ── Effect 4: original simple rotation — no traces, just the moving head ──
        ctx.fillStyle = isDark ? "#121212" : "#ffffff";
        ctx.fillRect(0, 0, width, height);
        drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1, TRACE_HEAD_OPACITY);
      }
    } else {
      // Full clear for other presets to keep them sharp
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, width, height);
      drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1);
    }

    // Advance time only when something is actually moving
    const isMode2Stopped = useDiscreteTraces && discreteEffect === 2 && mode2Phase !== 'rotating';
    if (!isMode2Stopped) time += 0.01;
    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    time = 0;              // always restart from zero so effect 2 rotates from the start
    resetDiscreteState();  // pick a fresh random effect each time draw is called
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (subsampling === 1) {
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      // Fast preview render during panning/dragging
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

      // Clear the canvas completely during drag to prevent trailing ghosts
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Draw the beautiful colored curve at full resolution
      drawRoseScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
    resetDiscreteState();
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Rose: {
      id: "Rose",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      get formula() { return PRESETS[currentPresetIndex].formula; },
      explanationUrl: "/tools/math-wonder-box/rose.html",
    },
  };
})(window);
