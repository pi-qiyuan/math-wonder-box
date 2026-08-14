(function registerAizawaAttractor(global) {
  const PRESETS = [
    { id: "classic", nameKey: "aizawa_preset_classic", a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, view: { centerX: 0, centerY: 0, scale: 6 } },
    { id: "sphere",  nameKey: "aizawa_preset_sphere",  a: 0.95, b: 0.7, c: 0.9, d: 3.5, e: 0.2,  f: 0.1, view: { centerX: 0, centerY: 0, scale: 6 } },
    { id: "heart",   nameKey: "aizawa_preset_heart",   a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, view: { centerX: 0, centerY: 0, scale: 6 }, plane: "yz" },
    { id: "top",     nameKey: "aizawa_preset_top",     a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, view: { centerX: 0, centerY: 0, scale: 6 }, plane: "xy" }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];
  
  let x = 0.1, y = 0.1, z = 0.1;
  const dt = 0.01;
  let animationId = null;
  let time = 0;
  let lastView = null;

  const MAX_HISTORY = 100000;
  const STRIDE = 4; 
  const ringBuf = new Float32Array(MAX_HISTORY * STRIDE);
  let ringHead = 0;  
  let ringCount = 0; 

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
  }

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
    const plane = activePreset.plane || "xz";
    const lightness = isDark ? 60 : 40;

    ctx.lineWidth = 1.5;

    const tail = ringTail();
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

    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.003)" : "rgba(255, 255, 255, 0.003)";
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = Math.min(width, height) / view.scale;

    ctx.lineWidth = 1.5;
    const { a, b, c, d, e, f } = activePreset;
    const plane = activePreset.plane || "xz";
    
    for (let i = 0; i < 5; i++) {
      let dx = ((z - b) * x - d * y) * dt;
      let dy = (d * x + (z - b) * y) * dt;
      let dz = (c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * (x * x * x)) * dt;

      let nx = x + dx;
      let ny = y + dy;
      let nz = z + dz;

      const hue = (time * 10) % 360;

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
      redrawHistory(canvas, view);
    }

    lastView = { ...view };

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const size = Math.min(width, height) / view.scale;
      const { a, b, c, d, e, f } = activePreset;
      const plane = activePreset.plane || "xz";

      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";
      
      let tx = x, ty = y, tz = z;
      for (let i = 0; i < 2000; i++) {
        let dx = ((tz - b) * tx - d * ty) * dt;
        let dy = (d * tx + (tz - b) * ty) * dt;
        let dz = (c + a * tz - (tz * tz * tz) / 3 - (tx * tx + ty * ty) * (1 + e * tz) + f * tz * (tx * tx * tx)) * dt;
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
    Aizawa: {
      id: "Aizawa",
      get defaultView() { return { ...activePreset.view }; },
      draw,
      cleanup,
      randomize,
      reset,
      get currentNameKey() { return activePreset.nameKey; },
      // formula: "dx/dt = (z-b)x - dy, dy/dt = dx + (z-b)y, dz/dt = c + az - z³/3 - (x²+y²)(1+ez) + fzx³",
      explanationUrl: "/tools/math-wonder-box/aizawa.html",
    },
  };
})(window);
