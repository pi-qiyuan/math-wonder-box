(function registerLissajousCurve(global) {
  const PRESETS = [
    { id: "unity",     nameKey: "lissajous_preset_unity",     a: 1, b: 1, delta: Math.PI / 2, drift: true, driftSpeed: 0.1  },
    { id: "infinity",  nameKey: "lissajous_preset_infinity",  a: 1, b: 2, delta: Math.PI / 2, drift: true, driftSpeed: 0.15 },
    { id: "classic",   nameKey: "lissajous_preset_classic",   a: 3, b: 2, delta: Math.PI / 2, drift: true, driftSpeed: 0.15 },
    { id: "lattice",   nameKey: "lissajous_preset_lattice",   a: 3, b: 4, delta: 0,           drift: true, driftSpeed: 0.12 },
    { id: "chaos",     nameKey: "lissajous_preset_chaos",     a: 5, b: 4, delta: 0,           drift: true, driftSpeed: 0.2  },
    { id: "geometric", nameKey: "lissajous_preset_geometric", a: 3, b: 5, delta: Math.PI / 2, drift: true, driftSpeed: 0.1  },
    { id: "weave",     nameKey: "lissajous_preset_weave",     a: 5, b: 6, delta: Math.PI / 4, drift: true, driftSpeed: 0.18 }
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
    
    // Force a full clear on randomize for a clean transition
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    return calculateOptimalView(canvas);
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    // Trailing effect - increased opacity for a cleaner/crisper look (from 0.05 to 0.15)
    ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.15)" : "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const size = (Math.min(width, height) * 0.4) / (view.scale / 1.5);

    let a = preset.a;
    let b = preset.b;
    let delta = preset.delta;

    if (preset.drift) {
      // Use preset-specific drift speed
      delta += time * (preset.driftSpeed || 0.2); 
    }

    ctx.beginPath();
    ctx.lineWidth = 3;
    const hue = (time * 8) % 360;
    ctx.strokeStyle = `hsla(${hue}, 70%, ${isDark ? 60 : 40}%, 0.8)`;

    // Draw the curve for a full cycle
    const quality = 400; 
    for (let t = 0; t <= Math.PI * 2; t += (Math.PI * 2) / quality) {
      const x = size * Math.sin(a * t + delta);
      const y = size * Math.sin(b * t);
      
      const px = x + centerX;
      const py = y + centerY;

      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const size = (Math.min(width, height) * 0.4) / (view.scale / 2.5);

      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";
      
      const quality = 100;
      for (let t = 0; t <= Math.PI * 2; t += (Math.PI * 2) / quality) {
        const x = size * Math.sin(preset.a * t + preset.delta);
        const y = size * Math.sin(preset.b * t);
        const px = x + centerX;
        const py = y + centerY;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Lissajous: {
      id: "Lissajous",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "x = A·sin(at + δ), y = B·sin(bt)",
      // explanationUrl: "explanations/lissajous.html",
    },
  };
})(window);
