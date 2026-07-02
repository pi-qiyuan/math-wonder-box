(function registerNoiseFlow(global) {
  // 预设配置
  const PRESETS = [
    { id: "nebula",     nameKey: "noise_preset_nebula",     particleCount: 2000, noiseScale: 0.005,   speed: 1.2, fade: 0.03, hueSpeed: 0.1, baseHue: 260, hueRange: 60,  saturation: 50, lineWidth: 1.0, opacity: 0.3 },
    { id: "wind",       nameKey: "noise_preset_wind",       particleCount: 1500, noiseScale: 0.003,   speed: 3.5, fade: 0.06, hueSpeed: 0.5, baseHue: 180, hueRange: 40,  saturation: 70, lineWidth: 0.8, opacity: 0.4 },
    { id: "vortex",     nameKey: "noise_preset_vortex",     particleCount: 3000, noiseScale: 0.002,   speed: 2.0, fade: 0.01, hueSpeed: 0.05,baseHue: 210, hueRange: 30,  saturation: 80, lineWidth: 1.5, opacity: 0.25 },
    { id: "silk",       nameKey: "noise_preset_silk",       particleCount: 1200, noiseScale: 0.001,   speed: 0.8, fade: 0.02, hueSpeed: 0.1, baseHue: 30,  hueRange: 30,  saturation: 20, lineWidth: 0.5, opacity: 0.5 },
    { id: "galaxy",     nameKey: "noise_preset_galaxy",     particleCount: 2500, noiseScale: 0.00025, speed: 1.5, fade: 0.04, hueSpeed: 0.3, baseHue: 0,   hueRange: 360, saturation: 60, lineWidth: 1.2, opacity: 0.4 },
    { id: "circuit",    nameKey: "noise_preset_circuit",    particleCount: 1200, noiseScale: 0.012,   speed: 2.0, fade: 0.05, hueSpeed: 0.0, baseHue: 100, hueRange: 40,  saturation: 90, lineWidth: 1.8, opacity: 0.7 },
    { id: "turbulence", nameKey: "noise_preset_turbulence", particleCount: 2000, noiseScale: 0.005,   speed: 4.0, fade: 0.1,  hueSpeed: 1.5, baseHue: 0,   hueRange: 50,  saturation: 85, lineWidth: 1.0, opacity: 0.6 },
     { id: "aurora",    nameKey: "noise_preset_aurora",     particleCount: 1800, noiseScale: 0.0005,  speed: 2.5, fade: 0.02, hueSpeed: 0.3, baseHue: 130, hueRange: 60,  saturation: 65, lineWidth: 2.2, opacity: 0.3 }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];

  let particles = [];
  let animationId = null;
  let time = 0;

  // 简单的噪声实现 (Pseudo-Perlin Noise)
  const p = new Uint8Array(512);
  const permutation = new Uint8Array(256).map(() => Math.floor(Math.random() * 256));
  for (let i = 0; i < 512; i++) p[i] = permutation[i % 256];

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(t, a, b) { return a + t * (b - a); }
  function grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function noise(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, aa = p[a], ab = p[a + 1], b = p[X + 1] + Y, ba = p[b], bb = p[b + 1];
    return lerp(v, lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
                   lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1)));
  }

  function initParticles(canvas) {
    particles = [];
    for (let i = 0; i < activePreset.particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        prevX: 0,
        prevY: 0,
        hue: (activePreset.baseHue + Math.random() * activePreset.hueRange) % 360
      });
      particles[i].prevX = particles[i].x;
      particles[i].prevY = particles[i].y;
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    
    // 拖尾效果：不完全清除上一帧
    ctx.fillStyle = isDark ? `rgba(18, 18, 18, ${activePreset.fade})` : `rgba(255, 255, 255, ${activePreset.fade})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const noiseScale = activePreset.noiseScale / (view.scale / 3);
    const speed = activePreset.speed;

    particles.forEach(pt => {
      // 计算噪声流场角度
      const nx = (pt.x - canvas.width / 2) * noiseScale + view.centerX;
      const ny = (pt.y - canvas.height / 2) * noiseScale + view.centerY;
      let angle = noise(nx, ny) * Math.PI * 4;

      // 特殊逻辑
      if (activePreset.id === "galaxy") {
        const dx = pt.x - canvas.width / 2;
        const dy = pt.y - canvas.height / 2;
        const angleToCenter = Math.atan2(dy, dx);
        angle += angleToCenter + Math.PI / 2; // 增加向心/切向力
      } else if (activePreset.id === "circuit") {
        angle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2); // 量化到90度
      }

      pt.prevX = pt.x;
      pt.prevY = pt.y;
      pt.x += Math.cos(angle) * speed;
      pt.y += Math.sin(angle) * speed;
      pt.hue = (pt.hue + activePreset.hueSpeed) % 360;

      // 绘制粒子
      ctx.beginPath();
      ctx.strokeStyle = `hsla(${pt.hue}, ${activePreset.saturation}%, ${isDark ? 60 : 40}%, ${activePreset.opacity})`;
      ctx.lineWidth = activePreset.lineWidth;
      ctx.moveTo(pt.prevX, pt.prevY);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();

      // 边界处理
      if (pt.x < 0 || pt.x > canvas.width || pt.y < 0 || pt.y > canvas.height) {
        pt.x = Math.random() * canvas.width;
        pt.y = Math.random() * canvas.height;
        pt.prevX = pt.x;
        pt.prevY = pt.y;
      }
    });

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    if (animationId) cancelAnimationFrame(animationId);
    
    // 如果粒子系统未初始化，重新初始化
    if (particles.length === 0) {
      initParticles(canvas);
    }

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function cleanup() {
    if (animationId) cancelAnimationFrame(animationId);
    particles = [];
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    activePreset = PRESETS[currentPresetIndex];
    
    // 切换预设时清空画布，防止残影
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    initParticles(canvas);
    return { centerX: 0, centerY: 0, scale: 3 };
  }

  function reset() {
    const canvas = document.getElementById("mandelbrotCanvas") || { width: 900, height: 900 };
    initParticles(canvas);
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    NoiseFlow: {
      id: "NoiseFlow",
      defaultView: { centerX: 0, centerY: 0, scale: 3 },
      draw,
      cleanup,
      randomize,
      reset,
      get currentNameKey() { return activePreset.nameKey; },
      formula: "v = ∇ × Noise(x, y)",
      // explanationUrl: "explanations/noise_flow.html"
    }
  };
})(window);
