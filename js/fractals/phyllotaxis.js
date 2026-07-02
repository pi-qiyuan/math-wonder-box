(function registerPhyllotaxis(global) {
  const GOLDEN_ANGLE = 137.508;

  const PRESETS = [
    { id: "seed-sprouter",         nameKey: "phyllotaxis_preset_seed",      angle: GOLDEN_ANGLE, c: 8,  dotSize: 4, colorMode: "growth",    growth: true  },
    { id: "angle-wanderer",        nameKey: "phyllotaxis_preset_wanderer",  angle: 137.3,        c: 10, dotSize: 3, colorMode: "wander",    growth: false },
    { id: "spectrum-wave",         nameKey: "phyllotaxis_preset_spectrum",  angle: GOLDEN_ANGLE, c: 12, dotSize: 5, colorMode: "spectrum",  growth: true  },
    { id: "crystalline-snowflake", nameKey: "phyllotaxis_preset_snowflake", angle: 99.505,       c: 14, dotSize: 3, colorMode: "crystal",   growth: true  },
    { id: "deep-sea-vortex",       nameKey: "phyllotaxis_preset_vortex",    angle: GOLDEN_ANGLE, c: 4,  dotSize: 2, colorMode: "vortex",    growth: true  },
    { id: "dandelion-puff",        nameKey: "phyllotaxis_preset_dandelion", angle: GOLDEN_ANGLE, c: 9,  dotSize: 8, colorMode: "dandelion", growth: true  },
    { id: "binary-bloom",          nameKey: "phyllotaxis_preset_binary",    angle: GOLDEN_ANGLE, c: 10, dotSize: 4, colorMode: "binary",    growth: true  },
    { id: "moire-ripple",          nameKey: "phyllotaxis_preset_ripple",    angle: GOLDEN_ANGLE, c: 11, dotSize: 3, colorMode: "ripple",    growth: false },
    { id: "quantum-cloud",         nameKey: "phyllotaxis_preset_cloud",     angle: GOLDEN_ANGLE, c: 12, dotSize: 2, colorMode: "cloud",     growth: true  }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;
  let growthCounter = 0;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0, scale: 1 / 0.6 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    growthCounter = 0; // Reset growth when switching presets
    return calculateOptimalView(canvas);
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (growthCounter === 0) {
      // Fully clear background on first frame of a cycle
      ctx.fillStyle = isDark ? "#121212" : "#ffffff";
      ctx.fillRect(0, 0, width, height);
    } else {
      // Semi-transparent fill for trailing effect
      ctx.fillStyle = isDark ? "rgba(18, 18, 18, 0.1)" : "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(0, 0, width, height);
    }

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    let currentAngle = preset.angle;
    if (preset.colorMode === "wander") {
      // Slower wander speed
      currentAngle += Math.sin(time * 0.1) * 0.2;
    } else if (preset.colorMode === "ripple") {
      // Linear drift to create Moire patterns
      currentAngle += time * 0.05;
    }

    const maxDots = 2000;
    if (preset.growth) {
      // Slower growth speed (1 dot per frame)
      growthCounter = Math.min(growthCounter + 0.5, maxDots);
    } else {
      growthCounter = maxDots / 2;
    }

    const centerX = width / 2 - (view.centerX * width / view.scale);
    const centerY = height / 2 - (view.centerY * height / view.scale);
    const scaleFactor = (Math.min(width, height) / 1000) / view.scale;

    for (let n = 0; n < growthCounter; n++) {
      let currentX, currentY;
      const a = n * currentAngle * (Math.PI / 180);
      const r = preset.c * Math.sqrt(n) * scaleFactor;

      const baseX = r * Math.cos(a) + centerX;
      const baseY = r * Math.sin(a) + centerY;

      currentX = baseX;
      currentY = baseY;

      let hue = 0;
      let sat = 70;
      let light = isDark ? 60 : 40;
      let alpha = 0.8;
      let sizeScale = 1;

      if (preset.colorMode === "growth") {
        hue = (n * 0.1 + time * 10) % 360;
      } else if (preset.colorMode === "wander") {
        hue = (180 + Math.sin(n * 0.01 + time) * 60) % 360;
      } else if (preset.colorMode === "spectrum") {
        hue = (n * 0.5 + time * 50) % 360;
        sat = 90;
      } else if (preset.colorMode === "crystal") {
        hue = (190 + Math.sin(n * 0.02 + time) * 30) % 360; // Icy blue/cyan
        sat = 80;
        light = isDark ? 75 : 45;
      } else if (preset.colorMode === "vortex") {
        const ratio = n / maxDots;
        hue = (200 + ratio * 60 + Math.sin(time) * 10) % 360; // Deep blue to cyan
        sat = 80 + ratio * 20;
        light = 20 + ratio * 50;
        sizeScale = 0.5 + Math.pow(ratio, 2) * 5; // Exponential size growth for 3D effect
        alpha = 0.4 + ratio * 0.6;
      } else if (preset.colorMode === "dandelion") {
        hue = 0; sat = 0; // White/Gray
        light = isDark ? 85 : 55;
        alpha = 0.4 + Math.sin(n * 0.1 + time) * 0.2;
      } else if (preset.colorMode === "binary") {
        if (n % 2 === 0) {
          hue = (330 + Math.sin(time) * 20) % 360; // Pinkish
          sat = 80;
        } else {
          hue = (190 + Math.cos(time) * 20) % 360; // Blueish
          sat = 80;
        }
        light = isDark ? 65 : 45;
      } else if (preset.colorMode === "ripple") {
        hue = (time * 20 + n * 0.05) % 360;
        sat = 60;
        light = isDark ? 70 : 50;
        alpha = 0.5;
      } else if (preset.colorMode === "cloud") {
        const jitter = (n / maxDots) * 30 * scaleFactor;
        currentX += (Math.random() - 0.5) * jitter;
        currentY += (Math.random() - 0.5) * jitter;
        hue = (280 + Math.sin(n * 0.01 + time) * 40) % 360; // Purple/Violet
        sat = 70;
        light = isDark ? 70 : 40;
        alpha = 0.3 + (1 - n / maxDots) * 0.4;
      }

      if (currentX < 0 || currentX > width || currentY < 0 || currentY > height) continue;

      if (preset.colorMode === "dandelion") {
        // Draw a short line segment pointing towards center
        const len = preset.dotSize * (1 + Math.sin(n * 0.05 + time) * 0.5) * scaleFactor;
        const angleToCenter = Math.atan2(centerY - currentY, centerX - currentX);
        
        ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
        ctx.lineWidth = 1 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        ctx.lineTo(currentX + Math.cos(angleToCenter) * len, currentY + Math.sin(angleToCenter) * len);
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
        const size = preset.dotSize * sizeScale * (1 + Math.sin(n * 0.05 + time) * 0.3) * scaleFactor;
        ctx.beginPath();
        ctx.arc(currentX, currentY, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Reset growth periodically if it's a "growth" preset and reached max
    if (preset.growth && growthCounter >= maxDots) {
        if (Math.random() < 0.0016) { 
             growthCounter = 0;
        }
    }

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
      const maxDots = 1000;
      const centerX = width / 2 - (view.centerX * width / view.scale);
      const centerY = height / 2 - (view.centerY * height / view.scale);
      const scaleFactor = (Math.min(width, height) / 1000) / view.scale;

      for (let n = 0; n < maxDots; n++) {
        const a = n * preset.angle * (Math.PI / 180);
        const r = preset.c * Math.sqrt(n) * scaleFactor;
        const x = r * Math.cos(a) + centerX;
        const y = r * Math.sin(a) + centerY;

        if (x < 0 || x > width || y < 0 || y > height) continue;

        ctx.fillStyle = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.arc(x, y, preset.dotSize * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function reset() {
    growthCounter = 0;
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Phyllotaxis: {
      id: "Phyllotaxis",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "φ = n · 137.5°, r = c√n",
      // explanationUrl: "explanations/phyllotaxis.html",
    },
  };
})(window);
