(function registerSpirograph(global) {
  const PRESETS = [
    { id: "classic_star",   nameKey: "spirograph_preset_classic_star",   R: 5,  r: 2,  d: 4,  driftSpeed: 0.5,  colorType: "rainbow",     formula: "R = 5, r = 2, d = 4"    },
    { id: "floral_mandala", nameKey: "spirograph_preset_floral_mandala", R: 8,  r: 3,  d: 5,  driftSpeed: 0.4,  colorType: "cyan-blue",   formula: "R = 8, r = 3, d = 5"    },
    { id: "hypnotic_web",   nameKey: "spirograph_preset_hypnotic_web",   R: 10, r: 7,  d: 6,  driftSpeed: 0.3,  colorType: "pink-orange", formula: "R = 10, r = 7, d = 6"   },
    { id: "geometric_rose", nameKey: "spirograph_preset_geometric_rose", R: 7,  r: 4,  d: 5,  driftSpeed: 0.35, colorType: "gold-purple", formula: "R = 7, r = 4, d = 5"    },
    { id: "cosmic_swirl",   nameKey: "spirograph_preset_cosmic_swirl",   R: 9,  r: 2,  d: 7,  driftSpeed: 0.25, colorType: "nebula",      formula: "R = 9, r = 2, d = 7"    },
    { id: "emerald_lace",   nameKey: "spirograph_preset_emerald_lace",   R: 13, r: 5,  d: 8,  driftSpeed: 0.3,  colorType: "emerald",     formula: "R = 13, r = 5, d = 8"   },
    { id: "fire_blossom",   nameKey: "spirograph_preset_fire_blossom",   R: 11, r: 4,  d: 9,  driftSpeed: 0.4,  colorType: "fire",        formula: "R = 11, r = 4, d = 9"   },
    { id: "violet_vortex",  nameKey: "spirograph_preset_violet_vortex",  R: 15, r: 11, d: 10, driftSpeed: 0.2,  colorType: "violet",      formula: "R = 15, r = 11, d = 10" }
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

  function drawSpirographScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling) {
    const R = preset.R;
    const r = preset.r;
    const baseD = preset.d;
    
    // Subtly animate the draw distance for a breathing effect
    const d = baseD * (0.85 + 0.15 * Math.sin(time * 0.8));
    const maxRad = Math.abs(R - r) + d;
    const scaleFactor = size / maxRad;
    
    // The curve closes when θ is a multiple of 2π * (r / gcd(R, r))
    // A simple way is to use 2π * r as a safe period for most integer R, r
    const period = 2 * Math.PI * r;
    const quality = subsampling === 1 ? 1500 : 400;
    
    const phi = time * preset.driftSpeed;
    const R_minus_r = R - r;
    const ratio = R_minus_r / r;

    ctx.beginPath();
    for (let i = 0; i <= quality; i++) {
      const theta = (i * period) / quality;
      const x = scaleFactor * (R_minus_r * Math.cos(theta) + d * Math.cos(ratio * theta + phi));
      const y = scaleFactor * (R_minus_r * Math.sin(theta) - d * Math.sin(ratio * theta + phi));
      
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
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

    drawSpirographScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, 1);

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

      drawSpirographScene(ctx, width, height, centerX, centerY, size, preset, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Spirograph: {
      id: "Spirograph",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      get formula() { 
        const p = PRESETS[currentPresetIndex];
        return `x = (R-r)cosθ + d·cos((R-r)θ/r), R=${p.R}, r=${p.r}, d=${p.d}`;
      },
      // explanationUrl: "explanations/spirograph.html",
    },
  };
})(window);
