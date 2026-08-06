(function registerPythagorasTree(global) {
  const MAX_DEPTH = 10;
  const GROW_SPEED = 0.03;

  const PRESETS = [
    { id: "classic-symmetric",  nameKey: "pythagoras_preset_classic", angle: Math.PI / 4,      colorType: "forest", formula: "α = 45°, β = 45°"     },
    { id: "leaning-tower",      nameKey: "pythagoras_preset_leaning", angle: Math.PI / 6,      colorType: "autumn", formula: "α = 30°, β = 60°"     },
    { id: "golden-spiral-tree", nameKey: "pythagoras_preset_golden",  angle: Math.asin(0.8),   colorType: "golden", formula: "α ≈ 53.1°, β ≈ 36.9°" },
    { id: "neon-dream",         nameKey: "pythagoras_preset_neon",    angle: Math.PI / 5,      colorType: "neon",   formula: "α = 36°, β = 54°"     },
    { id: "sakura-blossom",     nameKey: "pythagoras_preset_sakura",  angle: Math.PI * 0.195,  colorType: "sakura", formula: "α ≈ 35°, β ≈ 55°"     },
    { id: "ocean-depths",       nameKey: "pythagoras_preset_ocean",   angle: Math.asin(0.766), colorType: "ocean",  formula: "α ≈ 50°, β ≈ 40°"     },
    { id: "midnight-fire",      nameKey: "pythagoras_preset_fire",    angle: Math.PI * 0.222,  colorType: "fire",   formula: "α ≈ 40°, β ≈ 50°"     }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let growth = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    return { centerX: 0, centerY: 0.2, scale: 3.5 };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    reset();
    return calculateOptimalView(canvas);
  }

  function reset() {
    growth = 0;
    time = 0;
  }

  function drawRecursiveSquare(ctx, size, depth, growth, angle, colorType, isDark) {
    // How "grown" this depth level is: >=1 means fully grown,
    // a value in (0,1) means it is currently animating in,
    // <=0 means it hasn't started growing yet.
    const remaining = growth - depth;
    if (remaining <= 0) return;

    const progress = Math.min(remaining, 1);

    ctx.save();
    if (progress < 1) {
      // Smoothly scale and fade the square in as it grows,
      // instead of popping in at full size once `growth` crosses an integer.
      const scale = 0.4 + 0.6 * progress;
      ctx.scale(scale, scale);
      ctx.globalAlpha *= progress;
    }

    // Draw the square
    ctx.beginPath();
    ctx.rect(-size / 2, -size, size, size);
    
    // Coloring
    const depthRatio = depth / MAX_DEPTH;
    let color;
    if (colorType === "forest") {
      const g = 100 + depthRatio * 155;
      color = `rgba(34, ${g}, 34, ${1 - depthRatio * 0.5})`;
    } else if (colorType === "autumn") {
      const r = 200 + depthRatio * 55;
      const g = 50 + depthRatio * 150;
      color = `rgba(${r}, ${g}, 0, ${1 - depthRatio * 0.5})`;
    } else if (colorType === "golden") {
      color = `hsla(45, 100%, ${50 + depthRatio * 30}%, ${1 - depthRatio * 0.5})`;
    } else if (colorType === "neon") {
      color = `hsla(${(time * 50 + depth * 20) % 360}, 100%, 60%, ${1 - depthRatio * 0.5})`;
    } else if (colorType === "sakura") {
      // Soft pink blossoms near the trunk, brightening toward the tips
      const lightness = 75 + depthRatio * 20;
      const saturation = 70 - depthRatio * 10;
      color = `hsla(${340 + depthRatio * 15}, ${saturation}%, ${lightness}%, ${1 - depthRatio * 0.35})`;
    } else if (colorType === "ocean") {
      // Deep navy trunk fading into bright cyan/teal at the tips
      const hue = 200 + depthRatio * 30;
      const lightness = 25 + depthRatio * 45;
      color = `hsla(${hue}, 80%, ${lightness}%, ${1 - depthRatio * 0.4})`;
    } else if (colorType === "fire") {
      // Flickering flame colors that shift with time, like glowing embers
      const flicker = Math.sin(time * 3 + depth) * 8;
      const hue = 15 + depthRatio * 45 + flicker;
      color = `hsla(${hue}, 100%, ${55 + depthRatio * 20}%, ${1 - depthRatio * 0.4})`;
    } else {
      color = isDark ? `rgba(200, 200, 200, ${1 - depthRatio})` : `rgba(50, 50, 50, ${1 - depthRatio})`;
    }
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();

    // Only spawn children once this square has fully grown in.
    if (remaining >= 1 && depth < MAX_DEPTH) {
      const leftSize = size * Math.cos(angle);
      const rightSize = size * Math.sin(angle);

      // Left square
      ctx.save();
      ctx.translate(-size / 2, -size);
      ctx.rotate(-angle);
      ctx.translate(leftSize / 2, 0);
      drawRecursiveSquare(ctx, leftSize, depth + 1, growth, angle, colorType, isDark);
      ctx.restore();

      // Right square
      ctx.save();
      ctx.translate(size / 2, -size);
      ctx.rotate(Math.PI / 2 - angle);
      ctx.translate(-rightSize / 2, 0);
      drawRecursiveSquare(ctx, rightSize, depth + 1, growth, angle, colorType, isDark);
      ctx.restore();
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    time += 0.01;
    if (growth < MAX_DEPTH) {
      growth += GROW_SPEED;
      animationId = requestAnimationFrame(() => tick(canvas, view));
    }

    const preset = PRESETS[currentPresetIndex];
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    const baseSize = height / 5 / view.scale;
    const startX = (0 - view.centerX) / scaleX * width + width / 2;
    const startY = (0.8 - view.centerY) / scaleY * height + height / 2;

    ctx.save();
    ctx.translate(startX, startY);
    
    // Add a slight sway to the whole tree
    const sway = Math.sin(time) * 0.02;
    ctx.rotate(sway);

    drawRecursiveSquare(ctx, baseSize, 0, growth, preset.angle, preset.colorType, isDark);
    ctx.restore();
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const ctx = canvas.getContext("2d");
      const isDark = document.documentElement.classList.contains("theme-dark");
      ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const preset = PRESETS[currentPresetIndex];
      const width = canvas.width;
      const height = canvas.height;
      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;

      const baseSize = height / 5 / view.scale;
      const startX = (0 - view.centerX) / scaleX * width + width / 2;
      const startY = (0.8 - view.centerY) / scaleY * height + height / 2;

      ctx.save();
      ctx.translate(startX, startY);
      drawRecursiveSquare(ctx, baseSize, 0, growth, preset.angle, preset.colorType, isDark);
      ctx.restore();
    }
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    PythagorasTree: {
      id: "PythagorasTree",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      get formula() {
        return PRESETS[currentPresetIndex].formula;
      },
      explanationUrl: "/tools/math-wonder-box/pythagoras-tree.html",
    },
  };
})(window);
