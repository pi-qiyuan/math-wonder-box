(function registerLorenzAttractor(global) {
  const PRESETS = [
    { id: "classic", nameKey: "lorenz_preset_classic", σ: 10, ρ: 28,    β: 8/3, plane: "xz", view: { centerX: 0, centerY: -25, scale: 130 }  },
    { id: "mask",    nameKey: "lorenz_preset_mask",    σ: 10, ρ: 28,    β: 8/3, plane: "xy", view: { centerX: 0, centerY: 0, scale: 130 }    },
    { id: "heart",   nameKey: "lorenz_preset_heart",   σ: 10, ρ: 28,    β: 8/3, plane: "yz", view: { centerX: 0, centerY: -25, scale: 130 }  },
    { id: "ribbon",  nameKey: "lorenz_preset_ribbon",  σ: 10, ρ: 100,   β: 8/3, plane: "xz", view: { centerX: 0, centerY: -100, scale: 440 } },
    { id: "storm",   nameKey: "lorenz_preset_storm",   σ: 10, ρ: 99.96, β: 8/3, plane: "xz", view: { centerX: 0, centerY: -99, scale: 440 }  },
    { id: "galaxy",  nameKey: "lorenz_preset_galaxy",  σ: 10, ρ: 15,    β: 8/3, plane: "xy", view: { centerX: 0, centerY: 0, scale: 80 }     }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];
  
  let x = 0.1, y = 0.1, z = 0.1;
  const dt = 0.005;
  let animationId = null;
  let time = 0;
  let lastView = null;

  // Ring buffer: 4 floats per point (x, y, z, hue), fixed ~3.2MB, zero GC pressure
  const MAX_HISTORY = 200000;
  const STRIDE = 4; // x=0, y=1, z=2, hue=3
  const ringBuf = new Float32Array(MAX_HISTORY * STRIDE);
  let ringHead = 0;  // next write position (in points)
  let ringCount = 0; // how many valid points are stored (0..MAX_HISTORY)

  function ringPush(px, py, pz, hue) {
    const base = ringHead * STRIDE;
    ringBuf[base]     = px;
    ringBuf[base + 1] = py;
    ringBuf[base + 2] = pz;
    ringBuf[base + 3] = hue;
    ringHead = (ringHead + 1) % MAX_HISTORY;
    if (ringCount < MAX_HISTORY) ringCount++;
  }

  function ringClear() {
    ringHead = 0;
    ringCount = 0;
    // No need to zero the buffer — ringCount guards reads
  }

  // Returns the index (in points) of the oldest entry
  function ringTail() {
    return ringCount < MAX_HISTORY ? 0 : ringHead;
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
    x = 0.1; y = 0.1; z = 0.1;
    time = 0;
    ringClear();
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    activePreset = PRESETS[currentPresetIndex];
    
    x = 0.1; y = 0.1; z = 0.1;
    time = 0;
    lastView = null;
    ringClear();

    return { ...activePreset.view };
  }

  function project(nx, ny, nz, plane, size, centerX, centerY) {
    let px, py;
    if (plane === "xy") {
      px = nx * size + centerX;
      py = ny * size + centerY;
    } else if (plane === "yz") {
      px = ny * size + centerX;
      py = -nz * size + centerY;
    } else { // xz
      px = nx * size + centerX;
      py = -nz * size + centerY;
    }
    return { px, py };
  }

  // Redraw all ring buffer points with new view — called on zoom/pan
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
    const { plane } = activePreset;
    const lightness = isDark ? 60 : 40;

    ctx.lineWidth = 2;

    const tail = ringTail();
    // Walk the ring in chronological order
    for (let i = 1; i < ringCount; i++) {
      const iPrev = (tail + i - 1) % MAX_HISTORY;
      const iCurr = (tail + i)     % MAX_HISTORY;
      const bPrev = iPrev * STRIDE;
      const bCurr = iCurr * STRIDE;

      const p1 = project(ringBuf[bPrev], ringBuf[bPrev+1], ringBuf[bPrev+2], plane, size, centerX, centerY);
      const p2 = project(ringBuf[bCurr], ringBuf[bCurr+1], ringBuf[bCurr+2], plane, size, centerX, centerY);

      ctx.beginPath();
      ctx.strokeStyle = `hsla(${ringBuf[bCurr+3]}, 80%, ${lightness}%, 0.8)`;
      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.004)" : "rgba(255, 255, 255, 0.004)";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = Math.min(width, height) / view.scale;

    ctx.lineWidth = 2;
    const { σ, ρ, β, plane } = activePreset;
    
    for (let i = 0; i < 4; i++) {
      let dx = σ * (y - x) * dt;
      let dy = (x * (ρ - z) - y) * dt;
      let dz = (x * y - β * z) * dt;

      let nx = x + dx;
      let ny = y + dy;
      let nz = z + dz;

      const hue = (time * 15) % 360;

      ctx.beginPath();
      ctx.strokeStyle = `hsla(${hue}, 80%, ${isDark ? 60 : 40}%, 0.8)`;
      
      const p1 = project(x, y, z, plane, size, centerX, centerY);
      const p2 = project(nx, ny, nz, plane, size, centerX, centerY);

      ctx.moveTo(p1.px, p1.py);
      ctx.lineTo(p2.px, p2.py);
      ctx.stroke();

      ringPush(nx, ny, nz, hue);

      x = nx;
      y = ny;
      z = nz;
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
      x = 0.1; y = 0.1; z = 0.1;
      time = 0;
      ringClear();
    } else if (lastView && (lastView.scale !== view.scale || lastView.centerX !== view.centerX || lastView.centerY !== view.centerY)) {
      // View changed: re-project all history at pixel-perfect quality
      redrawHistory(canvas, view);
    }

    lastView = { ...view };

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const size = Math.min(width, height) / view.scale;
      const { σ, ρ, β, plane } = activePreset;

      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";
      
      let tx = x, ty = y, tz = z;
      for (let i = 0; i < 3000; i++) {
        let dx = σ * (ty - tx) * dt;
        let dy = (tx * (ρ - tz) - ty) * dt;
        let dz = (tx * ty - β * tz) * dt;
        let ntx = tx + dx;
        let nty = ty + dy;
        let ntz = tz + dz;

        const p = project(tx, ty, tz, plane, size, centerX, centerY);
        if (i === 0) ctx.moveTo(p.px, p.py);
        else ctx.lineTo(p.px, p.py);

        tx = ntx; ty = nty; tz = ntz;
      }
      ctx.stroke();
    }
  }

  function reset() {
    x = 0.1; y = 0.1; z = 0.1;
    time = 0;
    ringClear();
    lastView = null;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Lorenz: {
      id: "Lorenz",
      get defaultView() { return { ...activePreset.view }; },
      draw,
      cleanup,
      randomize,
      reset,
      get currentNameKey() { return activePreset.nameKey; },
      formula: "dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz",
      explanationUrl: "/tools/math-wonder-box/lorenz.html",
    },
  };
})(window);
