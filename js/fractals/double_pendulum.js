(function registerDoublePendulum(global) {
  const PRESETS = [
    { id: "classic",    nameKey: "double_pendulum_preset_classic",    m1: 10, m2: 10, l1: 1,   l2: 1,   th1: Math.PI / 2, th2: Math.PI / 2, view: { centerX: 0, centerY: 0.5, scale: 4.5 } },
    { id: "unbalanced", nameKey: "double_pendulum_preset_unbalanced", m1: 20, m2: 5,  l1: 0.8, l2: 1.2, th1: Math.PI / 3, th2: Math.PI,     view: { centerX: 0, centerY: 0.5, scale: 4.5 } },
    { id: "extended",   nameKey: "double_pendulum_preset_extended",   m1: 10, m2: 10, l1: 1.5, l2: 0.5, th1: Math.PI,     th2: Math.PI / 4, view: { centerX: 0, centerY: 0.5, scale: 5 }   },
    { id: "chaos_high", nameKey: "double_pendulum_preset_chaos_high", m1: 10, m2: 10, l1: 1,   l2: 1,   th1: 2.1,         th2: 2.4,         view: { centerX: 0, centerY: 0.5, scale: 4.5 } }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 2);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];
  
  // State: [theta1, omega1, theta2, omega2]
  let state = [activePreset.th1, 0, activePreset.th2, 0];
  const g = 9.81;
  const dt = 0.01;
  let animationId = null;
  let time = 0;
  let lastView = null;

  const MAX_HISTORY = 10000; // Sufficient for a long trail
  const STRIDE = 3; // x2, y2, hue
  const ringBuf = new Float32Array(MAX_HISTORY * STRIDE);
  let ringHead = 0;  
  let ringCount = 0; 

  // ---------------------------------------------------------------------
  // Feature additions:
  //  1. Phase portrait inset (theta1 vs omega1)
  //  2. "Twin"/chaos divergence trajectory (one perturbed copy highlighted)
  //  3. Energy conservation graph (sanity-checks the RK4 integration)
  //  4. Velocity arrows on the two bobs
  //  5. Ensemble "feather" cloud of many slightly perturbed pendulums
  // ---------------------------------------------------------------------

  const ENSEMBLE_SIZE = 14;          // includes the highlighted "twin" as index 0
  const ENSEMBLE_TRAIL_LEN = 220;    // short fading trail per ensemble member
  let ensembleStates = [];
  let ensembleTrails = [];           // [{buf:Float32Array(len*2), head, count}]

  const PHASE_HISTORY = 8000;
  const phaseBuf = new Float32Array(PHASE_HISTORY * 2); // theta1, omega1
  let phaseHead = 0, phaseCount = 0;

  const ENERGY_HISTORY = 360;        // scrolling window of recent energy samples
  const energyBuf = new Float32Array(ENERGY_HISTORY);
  let energyHead = 0, energyCount = 0;
  let baselineEnergy = null;

  function ringPush(px, py, hue) {
    const base = ringHead * STRIDE;
    ringBuf[base]     = px;
    ringBuf[base + 1] = py;
    ringBuf[base + 2] = hue;
    ringHead = (ringHead + 1) % MAX_HISTORY;
    if (ringCount < MAX_HISTORY) ringCount++;
  }

  function ringClear() {
    ringHead = 0;
    ringCount = 0;
  }

  function ringTail() {
    return ringCount < MAX_HISTORY ? 0 : ringHead;
  }

  function trailPush(trail, px, py) {
    const base = trail.head * 2;
    trail.buf[base] = px;
    trail.buf[base + 1] = py;
    trail.head = (trail.head + 1) % ENSEMBLE_TRAIL_LEN;
    if (trail.count < ENSEMBLE_TRAIL_LEN) trail.count++;
  }

  function trailTail(trail) {
    return trail.count < ENSEMBLE_TRAIL_LEN ? 0 : trail.head;
  }

  function phasePush(th1, w1) {
    const base = phaseHead * 2;
    phaseBuf[base] = th1;
    phaseBuf[base + 1] = w1;
    phaseHead = (phaseHead + 1) % PHASE_HISTORY;
    if (phaseCount < PHASE_HISTORY) phaseCount++;
  }

  function phaseTail() {
    return phaseCount < PHASE_HISTORY ? 0 : phaseHead;
  }

  function energyPush(e) {
    energyBuf[energyHead] = e;
    energyHead = (energyHead + 1) % ENERGY_HISTORY;
    if (energyCount < ENERGY_HISTORY) energyCount++;
  }

  function energyTail() {
    return energyCount < ENERGY_HISTORY ? 0 : energyHead;
  }

  function computeEnergy(s, m1, m2, l1, l2) {
    const [th1, w1, th2, w2] = s;
    const KE = 0.5 * (m1 + m2) * l1 * l1 * w1 * w1
             + 0.5 * m2 * l2 * l2 * w2 * w2
             + m2 * l1 * l2 * w1 * w2 * Math.cos(th1 - th2);
    const PE = -(m1 + m2) * g * l1 * Math.cos(th1) - m2 * g * l2 * Math.cos(th2);
    return KE + PE;
  }

  function derivatives(s, m1, m2, l1, l2) {
    const [th1, w1, th2, w2] = s;
    const delta = th1 - th2;
    const den = (2 * m1 + m2 - m2 * Math.cos(2 * th1 - 2 * th2));

    const a1 = (-g * (2 * m1 + m2) * Math.sin(th1) 
               - m2 * g * Math.sin(th1 - 2 * th2) 
               - 2 * Math.sin(delta) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(delta))) 
               / (l1 * den);

    // Fixed: was incorrectly (m1 + m1) instead of (m1 + m2).
    const a2 = (2 * Math.sin(delta) * (w1 * w1 * l1 * (m1 + m2)
               + g * (m1 + m2) * Math.cos(th1) 
               + w2 * w2 * l2 * m2 * Math.cos(delta))) 
               / (l2 * den);

    return [w1, a1, w2, a2];
  }

  // RK4 Integration
  function stepRK4(s, m1, m2, l1, l2, dt) {
    const k1 = derivatives(s, m1, m2, l1, l2);
    
    const s2 = s.map((v, i) => v + k1[i] * dt / 2);
    const k2 = derivatives(s2, m1, m2, l1, l2);
    
    const s3 = s.map((v, i) => v + k2[i] * dt / 2);
    const k3 = derivatives(s3, m1, m2, l1, l2);
    
    const s4 = s.map((v, i) => v + k3[i] * dt);
    const k4 = derivatives(s4, m1, m2, l1, l2);
    
    return s.map((v, i) => v + (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) * dt / 6);
  }

  function getPositions(s, l1, l2) {
    const [th1, , th2, ] = s;
    const x1 = l1 * Math.sin(th1);
    const y1 = l1 * Math.cos(th1);
    const x2 = x1 + l2 * Math.sin(th2);
    const y2 = y1 + l2 * Math.cos(th2);
    return { x1, y1, x2, y2 };
  }

  function getVelocity(s, l1, l2) {
    const [th1, w1, th2, w2] = s;
    const vx1 = l1 * Math.cos(th1) * w1;
    const vy1 = -l1 * Math.sin(th1) * w1;
    const vx2 = vx1 + l2 * Math.cos(th2) * w2;
    const vy2 = vy1 - l2 * Math.sin(th2) * w2;
    return { vx1, vy1, vx2, vy2 };
  }

  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function cleanup() {
    stopAnimation();
    lastView = null;
    ringClear();
  }

  function initEnsemble() {
    ensembleStates = [];
    ensembleTrails = [];
    for (let i = 0; i < ENSEMBLE_SIZE; i++) {
      // Each member starts with a tiny, increasing perturbation on theta1 so
      // the fan of trajectories visibly diverges over time (sensitivity to
      // initial conditions). Index 0 is the "twin" used for the dedicated
      // chaos-divergence comparison against the primary trajectory.
      const eps = (i === 0) ? 0.0005 : (i + 1) * 0.00025;
      ensembleStates.push([activePreset.th1 + eps, 0, activePreset.th2, 0]);
      ensembleTrails.push({ buf: new Float32Array(ENSEMBLE_TRAIL_LEN * 2), head: 0, count: 0 });
    }
  }

  function clearAnalytics() {
    phaseHead = 0; phaseCount = 0;
    energyHead = 0; energyCount = 0;
    baselineEnergy = null;
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    activePreset = PRESETS[currentPresetIndex];
    
    state = [activePreset.th1, 0, activePreset.th2, 0];
    time = 0;
    lastView = null;
    ringClear();
    initEnsemble();
    clearAnalytics();

    return { ...activePreset.view };
  }

  function redrawHistory(canvas, view) {
    if (ringCount < 2) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = Math.min(width, height) / view.scale;
    const lightness = isDark ? 60 : 40;

    ctx.lineWidth = 2;
    const tail = ringTail();
    
    for (let i = 1; i < ringCount; i++) {
      const iPrev = (tail + i - 1) % MAX_HISTORY;
      const iCurr = (tail + i)     % MAX_HISTORY;
      const bPrev = iPrev * STRIDE;
      const bCurr = iCurr * STRIDE;

      const x1 = ringBuf[bPrev] * size + centerX;
      const y1 = ringBuf[bPrev+1] * size + centerY;
      const x2 = ringBuf[bCurr] * size + centerX;
      const y2 = ringBuf[bCurr+1] * size + centerY;

      ctx.beginPath();
      ctx.strokeStyle = `hsla(${ringBuf[bCurr+2]}, 80%, ${lightness}%, 0.8)`;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function drawEnsembleAndTwin(ctx, centerX, centerY, size, isDark) {
    for (let e = 0; e < ensembleStates.length; e++) {
      const trail = ensembleTrails[e];
      if (trail.count < 2) continue;
      const tail = trailTail(trail);
      const isTwin = e === 0;
      const baseHue = isTwin ? 200 : 320; // twin = cyan/blue, cloud = magenta family
      const alpha = isTwin ? 0.9 : 0.18;
      ctx.lineWidth = isTwin ? 2 : 1;
      for (let i = 1; i < trail.count; i++) {
        const iPrev = (tail + i - 1) % ENSEMBLE_TRAIL_LEN;
        const iCurr = (tail + i) % ENSEMBLE_TRAIL_LEN;
        const bPrev = iPrev * 2;
        const bCurr = iCurr * 2;
        const fade = i / trail.count; // newer segments more opaque
        ctx.beginPath();
        ctx.strokeStyle = isDark
          ? `hsla(${baseHue}, 85%, 65%, ${alpha * fade})`
          : `hsla(${baseHue}, 85%, 45%, ${alpha * fade})`;
        ctx.moveTo(trail.buf[bPrev] * size + centerX, trail.buf[bPrev + 1] * size + centerY);
        ctx.lineTo(trail.buf[bCurr] * size + centerX, trail.buf[bCurr + 1] * size + centerY);
        ctx.stroke();
      }
    }
  }

  function drawVelocityArrows(ctx, pNew, vel, centerX, centerY, size, isDark) {
    const color = isDark ? "rgba(255, 220, 90, 0.9)" : "rgba(180, 110, 0, 0.9)";
    const scale = 0.12; // visual scale for velocity vectors

    function arrow(px, py, vx, vy) {
      const x0 = px * size + centerX;
      const y0 = py * size + centerY;
      const x1 = x0 + vx * scale * size;
      const y1 = y0 + vy * scale * size;
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const headLen = 7;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    arrow(pNew.x1, pNew.y1, vel.vx1, vel.vy1);
    arrow(pNew.x2, pNew.y2, vel.vx2, vel.vy2);
  }

  function drawInsetFrame(ctx, x, y, w, h, isDark, title) {
    ctx.fillStyle = isDark ? "rgba(20, 20, 20, 0.55)" : "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)";
    ctx.font = "10px sans-serif";
    ctx.fillText(title, x + 6, y + 12);
  }

  function drawPhasePortrait(ctx, x, y, w, h, isDark) {
    drawInsetFrame(ctx, x, y, w, h, isDark, chrome.i18n.getMessage("double_pendulum_phase"));
    if (phaseCount < 2) return;

    const plotX = x + 6, plotY = y + 18, plotW = w - 12, plotH = h - 24;
    // Fixed axis ranges keep the inset stable frame to frame.
    const thRange = Math.PI;      // theta1 roughly in [-PI, PI]
    const wRange = 14;            // omega1 typical range for this system

    function toPx(th, w_) {
      const px = plotX + ((th + thRange) / (2 * thRange)) * plotW;
      const py = plotY + plotH - ((w_ + wRange) / (2 * wRange)) * plotH;
      return [px, py];
    }

    // Clip so fast/extreme swings of omega1 never escape the inset box.
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = isDark ? "rgba(100, 200, 255, 0.8)" : "rgba(20, 90, 160, 0.8)";
    ctx.lineWidth = 1;
    const tail = phaseTail();
    ctx.beginPath();
    for (let i = 0; i < phaseCount; i++) {
      const idx = (tail + i) % PHASE_HISTORY;
      const base = idx * 2;
      const [px, py] = toPx(phaseBuf[base], phaseBuf[base + 1]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawEnergyGraph(ctx, x, y, w, h, isDark) {
    drawInsetFrame(ctx, x, y, w, h, isDark, chrome.i18n.getMessage("double_pendulum_energy"));
    if (energyCount < 2 || baselineEnergy === null) return;

    const plotX = x + 6, plotY = y + 18, plotW = w - 12, plotH = h - 24;
    const tail = energyTail();

    // Auto-scale the vertical range to whatever deviation is actually
    // present in the current window, so the curve always stays inside the
    // box instead of drifting off-screen if numerical drift accumulates.
    let maxDev = 1e-6;
    for (let i = 0; i < energyCount; i++) {
      const idx = (tail + i) % ENERGY_HISTORY;
      const dev = Math.abs(energyBuf[idx] - baselineEnergy);
      if (dev > maxDev) maxDev = dev;
    }
    const range = maxDev * 1.15; // small headroom so the line doesn't touch the edges

    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(plotX, plotY + plotH / 2);
    ctx.lineTo(plotX + plotW, plotY + plotH / 2);
    ctx.stroke();

    ctx.strokeStyle = isDark ? "rgba(120, 255, 160, 0.9)" : "rgba(0, 140, 70, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < energyCount; i++) {
      const idx = (tail + i) % ENERGY_HISTORY;
      const dev = energyBuf[idx] - baselineEnergy;
      const px = plotX + (i / (ENERGY_HISTORY - 1)) * plotW;
      const py = plotY + plotH / 2 - (dev / range) * (plotH / 2);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Show the actual drift magnitude as text so the auto-scaling doesn't
    // hide whether drift is negligible (good RK4 behavior) or growing
    // (a sign of a real bug or too-large a time step).
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
    ctx.font = "9px sans-serif";
    ctx.fillText(`±${maxDev.toFixed(3)} J`, x + 6, y + h - 4);
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    // Motion blur effect
    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.02)" : "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = Math.min(width, height) / view.scale;

    const { m1, m2, l1, l2 } = activePreset;
    
    // Multiple sub-steps for smoothness
    for (let i = 0; i < 2; i++) {
      const pOld = getPositions(state, l1, l2);
      state = stepRK4(state, m1, m2, l1, l2, dt);
      const pNew = getPositions(state, l1, l2);

      // Step the ensemble / twin alongside the primary trajectory.
      for (let e = 0; e < ensembleStates.length; e++) {
        ensembleStates[e] = stepRK4(ensembleStates[e], m1, m2, l1, l2, dt);
        const pe = getPositions(ensembleStates[e], l1, l2);
        trailPush(ensembleTrails[e], pe.x2, pe.y2);
      }

      const hue = (time * 20) % 360;

      // Draw the trail (second pendulum)
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(${hue}, 80%, ${isDark ? 65 : 45}%, 0.8)`;
      ctx.moveTo(pOld.x2 * size + centerX, pOld.y2 * size + centerY);
      ctx.lineTo(pNew.x2 * size + centerX, pNew.y2 * size + centerY);
      ctx.stroke();

      ringPush(pNew.x2, pNew.y2, hue);

      // Phase portrait + energy sampling (primary trajectory only)
      phasePush(state[0], state[1]);
      const e = computeEnergy(state, m1, m2, l1, l2);
      if (baselineEnergy === null) baselineEnergy = e;
      energyPush(e);

      // Draw the physical pendulum rods (optional, but good for visual context)
      // We only draw them once per frame, so outside this loop or very faintly
      if (i === 1) {
        drawEnsembleAndTwin(ctx, centerX, centerY, size, isDark);

        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)";
        ctx.lineCap = "round";
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pNew.x1 * size + centerX, pNew.y1 * size + centerY);
        ctx.lineTo(pNew.x2 * size + centerX, pNew.y2 * size + centerY);
        ctx.stroke();
        
        // Draw joints
        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.2)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.arc(pNew.x1 * size + centerX, pNew.y1 * size + centerY, 4, 0, Math.PI * 2);
        ctx.fill();

        const vel = getVelocity(state, l1, l2);
        drawVelocityArrows(ctx, pNew, vel, centerX, centerY, size, isDark);

        // Insets drawn last so they sit on top of everything else.
        const insetW = 130, insetH = 90, margin = 8;
        drawPhasePortrait(ctx, margin, margin, insetW, insetH, isDark);
        drawEnergyGraph(ctx, width - insetW - margin, margin, insetW, insetH, isDark);
      }

      time += dt;
    }

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    stopAnimation();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    const width = canvas.width;
    const height = canvas.height;

    const isReset = !lastView || (
      view.scale === activePreset.view.scale &&
      view.centerX === activePreset.view.centerX &&
      view.centerY === activePreset.view.centerY
    );

    if (isReset) {
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, width, height);
      state = [activePreset.th1, 0, activePreset.th2, 0];
      time = 0;
      ringClear();
      if (ensembleStates.length === 0) initEnsemble();
      clearAnalytics();
    } else if (lastView && (lastView.scale !== view.scale || lastView.centerX !== view.centerX || lastView.centerY !== view.centerY)) {
      redrawHistory(canvas, view);
    }

    lastView = { ...view };

    if (ensembleStates.length === 0) initEnsemble();

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      // Static/Dragging preview
      redrawHistory(canvas, view);
    }
  }

  function reset() {
    state = [activePreset.th1, 0, activePreset.th2, 0];
    time = 0;
    ringClear();
    lastView = null;
    initEnsemble();
    clearAnalytics();
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    DoublePendulum: {
      id: "DoublePendulum",
      get defaultView() { return { ...activePreset.view }; },
      draw,
      cleanup,
      randomize,
      reset,
      get currentNameKey() { return activePreset.nameKey; },
      // formula: "Chaos in Gravity",
      // explanationUrl: "explanations/double_pendulum.html",
    },
  };
})(window);
