(function registerEpicycloid(global) {
  const PRESETS = [
    { id: "cardioid",      nameKey: "epicycloid_preset_cardioid",      R: 1,  r: 1, d: 1,   driftSpeed: 0.5,  colorType: "pink-orange" },
    { id: "nephroid",      nameKey: "epicycloid_preset_nephroid",      R: 2,  r: 1, d: 1,   driftSpeed: 0.4,  colorType: "cyan-blue"   },
    { id: "spiro_star",    nameKey: "epicycloid_preset_spiro_star",    R: 5,  r: 3, d: 4,   driftSpeed: 0.3,  colorType: "rainbow"     },
    { id: "sunflower",     nameKey: "epicycloid_preset_sunflower",     R: 7,  r: 5, d: 6,   driftSpeed: 0.25, colorType: "gold-purple" },
    { id: "cosmic_rose",   nameKey: "epicycloid_preset_cosmic_rose",   R: 8,  r: 3, d: 5,   driftSpeed: 0.3,  colorType: "nebula"      },
    { id: "hypnotic_ring", nameKey: "epicycloid_preset_hypnotic_ring", R: 7,  r: 2, d: 3.5, driftSpeed: 0.35, colorType: "emerald"     },
    { id: "dahlia",        nameKey: "epicycloid_preset_dahlia",        R: 9,  r: 4, d: 6,   driftSpeed: 0.25, colorType: "fire"        },
    { id: "galaxy",        nameKey: "epicycloid_preset_galaxy",        R: 11, r: 6, d: 8,   driftSpeed: 0.2,  colorType: "violet"      },
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0, scale: 2.5 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    
    // Clear canvas fully on randomize
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return calculateOptimalView(canvas);
  }

  function drawEpicycloidScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling) {
    const R = preset.R;
    const r = preset.r;
    const baseD = preset.d;
    
    // Subtly animate the draw distance for a breathing effect
    const d = baseD * (0.85 + 0.15 * Math.sin(time * 0.8));
    const maxRad = R + r + d;
    const scaleFactor = size / maxRad;
    
    const period = 2 * Math.PI * r;
    const quality = subsampling === 1 ? 1200 : 300;
    
    const phi = time * preset.driftSpeed;
    const R_plus_r = R + r;
    const ratio = R_plus_r / r;

    ctx.beginPath();
    for (let i = 0; i <= quality; i++) {
      const theta = (i * period) / quality;
      const x = scaleFactor * (R_plus_r * Math.cos(theta) - d * Math.cos(ratio * theta + phi));
      const y = scaleFactor * (R_plus_r * Math.sin(theta) - d * Math.sin(ratio * theta + phi));
      
      const px = x + centerX;
      const py = y + centerY;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Radial gradient coloring matching the theme & preset
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
    } else if (preset.colorType === "gold-purple") {
      grad.addColorStop(0, `hsla(${(45 + Math.sin(time) * 10) % 360}, 95%, ${isDark ? 65 : 45}%, 0.8)`);
      grad.addColorStop(0.5, `hsla(${(160 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 60 : 40}%, 0.8)`);
      grad.addColorStop(1, `hsla(${(280 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 55 : 35}%, 0.8)`);
    } else if (preset.colorType === "nebula") {
      grad.addColorStop(0, `hsla(${(300 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(0.5, `hsla(${(260 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 60 : 45}%, 0.8)`);
      grad.addColorStop(1, `hsla(${(220 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 50 : 35}%, 0.8)`);
    } else if (preset.colorType === "emerald") {
      grad.addColorStop(0, `hsla(${(160 + Math.sin(time) * 15) % 360}, 90%, ${isDark ? 65 : 45}%, 0.8)`);
      grad.addColorStop(0.5, `hsla(${(140 + Math.sin(time) * 10) % 360}, 85%, ${isDark ? 60 : 40}%, 0.8)`);
      grad.addColorStop(1, `hsla(${(120 + Math.sin(time) * 15) % 360}, 80%, ${isDark ? 50 : 35}%, 0.8)`);
    } else if (preset.colorType === "fire") {
      grad.addColorStop(0, `hsla(${(50 + Math.sin(time) * 10) % 360}, 95%, ${isDark ? 70 : 50}%, 0.8)`);
      grad.addColorStop(0.5, `hsla(${(25 + Math.sin(time) * 5) % 360}, 95%, ${isDark ? 60 : 45}%, 0.8)`);
      grad.addColorStop(1, `hsla(${(5 + Math.sin(time) * 10) % 360}, 95%, ${isDark ? 50 : 35}%, 0.8)`);
    }

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = subsampling === 1 ? 6 : 4;
    ctx.globalAlpha = 0.25;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = subsampling === 1 ? 2.2 : 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    // Clear canvas fully to remove ghosting
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale) - 50;
    const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

    drawEpicycloidScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1);

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

      drawEpicycloidScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Epicycloid: {
      id: "Epicycloid",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      /*
      get formula() { 
        const p = PRESETS[currentPresetIndex];
        return `x = (R+r)cosθ - d·cos((R+r)θ/r), R=${p.R}, r=${p.r}, d=${p.d}`;
      },
      explanationUrl: "explanations/epicycloid.html",
      */
    },
  };
})(window);
