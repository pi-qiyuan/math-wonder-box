(function registerPenroseTiling(global) {
  const PHI = (1 + Math.sqrt(5)) / 2;

  const PRESETS = [
    { id: "classic",      nameKey: "penrose_preset_classic",      maxDepth: 7, tilingMode: "triangles", colorMode: "classic", colors: { stroke: "rgba(0,0,0,0.2)",         acute: "#FFD700", obtuse: "#1E90FF"} },
    { id: "rainbow",      nameKey: "penrose_preset_rainbow",      maxDepth: 6, tilingMode: "triangles", colorMode: "rainbow", colors: { stroke: "rgba(255,255,255,0.1)" },                                          },
    { id: "forest",       nameKey: "penrose_preset_forest",       maxDepth: 7, tilingMode: "triangles", colorMode: "classic", colors: { stroke: "rgba(0,0,0,0.1)",         acute: "#2E8B57", obtuse: "#8FBC8F"} },
    { id: "night",        nameKey: "penrose_preset_night",        maxDepth: 8, tilingMode: "triangles", colorMode: "classic", colors: { stroke: "rgba(255,255,255,0.2)",   acute: "#8A2BE2", obtuse: "#4B0082"} },
    { id: "kite_dart",    nameKey: "penrose_preset_kite_dart",    maxDepth: 6, tilingMode: "kitedart",  colorMode: "classic", colors: { stroke: "rgba(0,0,0,0.25)",        kite: "#FFD9B3",  dart: "#5C4D7D"}   },
    { id: "aurora",       nameKey: "penrose_preset_aurora",       maxDepth: 7, tilingMode: "rhombus",   colorMode: "radial",  colors: { stroke: "rgba(255,255,255,0.15)"},                                          },
    { id: "inflation",    nameKey: "penrose_preset_inflation",    maxDepth: 7, tilingMode: "rhombus",   colorMode: "classic", colors: { stroke: "rgba(0,0,0,0.2)",         acute: "#F4A300", obtuse: "#2C7DA0"}, animate: { growth: "pingpong" } },
    { id: "depth_bloom",  nameKey: "penrose_preset_depth_bloom",  maxDepth: 7, tilingMode: "kitedart",  colorMode: "depth",   colors: { stroke: "rgba(0,0,0,0.2)",         depthInner: "#FFF3B0",  depthOuter: "#7B2D8E"} },
    { id: "spin",         nameKey: "penrose_preset_spin",         maxDepth: 7, tilingMode: "rhombus",   colorMode: "classic", colors: { stroke: "rgba(255,255,255,0.15)",  acute: "#FF6B6B",       obtuse: "#1A535C"},animate: { rotate: true, rotateSpeed: 0.004 } },
    { id: "breathing",    nameKey: "penrose_preset_breathing",    maxDepth: 6, tilingMode: "kitedart",  colorMode: "radial",  colors: { stroke: "rgba(255,255,255,0.12)"}, animate: { breathe: true, breatheSpeed: 0.03 } },
    { id: "kaleidoscope", nameKey: "penrose_preset_kaleidoscope", maxDepth: 7, tilingMode: "kitedart",  colorMode: "depth",   colors: { stroke: "rgba(255,255,255,0.15)",  depthInner: "#FDE49C",  depthOuter: "#22177A"},animate: { rotate: true, rotateSpeed: 0.006, breathe: true, breatheSpeed: 0.025 } }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;

  function cleanup() {}

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    time = 0;
    return { centerX: 0, centerY: 0, scale: 2.5 };
  }

  function reset() {
    time = 0;
  }

  // --- 颜色辅助函数 ---
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  }

  function lerpHex(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const clamp = Math.max(0, Math.min(1, t));
    return {
      r: Math.round(a.r + (b.r - a.r) * clamp),
      g: Math.round(a.g + (b.g - a.g) * clamp),
      b: Math.round(a.b + (b.b - a.b) * clamp)
    };
  }

  function getFillColor(unit, index, preset, isDark, t) {
    const colors = preset.colors;
    switch (preset.colorMode) {
      case "rainbow":
        return `hsla(${(index * 7) % 360}, 70%, ${isDark ? 60 : 50}%, 0.8)`;
      case "radial": {
        const cx = unit.points.reduce((s, p) => s + p.x, 0) / unit.points.length;
        const cy = unit.points.reduce((s, p) => s + p.y, 0) / unit.points.length;
        const dist = Math.hypot(cx, cy);
        const hue = (dist * 140 + t * 0.4) % 360;
        return `hsla(${hue}, 75%, ${isDark ? 58 : 48}%, 0.85)`;
      }
      case "depth": {
        const ratio = preset.maxDepth ? unit.depth / preset.maxDepth : 0;
        const rgb = lerpHex(colors.depthInner, colors.depthOuter, ratio);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      }
      default: {
        if (unit.kiteOrDart) {
          return unit.kiteOrDart === "kite" ? colors.kite : colors.dart;
        }
        return unit.type === 0 ? colors.acute : colors.obtuse;
      }
    }
  }

  // 三角波：在 minDepth 与 maxDepth 之间往返（膨胀 -> 停留 -> 收缩 -> 停留 -> 循环）
  function pingpongDepth(t, minDepth, maxDepth, framesPerLevel, holdFrames) {
    const levels = Math.max(1, maxDepth - minDepth);
    const growLen = levels * framesPerLevel;
    const cycle = 2 * growLen + 2 * holdFrames;
    const phase = t % cycle;
    if (phase < growLen) {
      return minDepth + Math.floor(phase / framesPerLevel);
    }
    if (phase < growLen + holdFrames) {
      return maxDepth;
    }
    if (phase < 2 * growLen + holdFrames) {
      const shrinkPhase = phase - growLen - holdFrames;
      return maxDepth - Math.floor(shrinkPhase / framesPerLevel);
    }
    return minDepth;
  }

  // P3 Rhombus deflation triangles
  // Type 0: Acute (72, 72, 36)
  // Type 1: Obtuse (36, 36, 108)
  function subdivide(triangles) {
    const result = [];
    triangles.forEach(tri => {
      const { type, A, B, C, depth } = tri;
      const childDepth = (depth || 0) + 1;
      if (type === 0) {
        // Acute (A is 36 apex)
        // New point P = B + (A - B) / PHI
        // New point Q = B + (C - B) / PHI
        const P = { x: B.x + (A.x - B.x) / PHI, y: B.y + (A.y - B.y) / PHI };
        const Q = { x: B.x + (C.x - B.x) / PHI, y: B.y + (C.y - B.y) / PHI };
        result.push({ type: 0, A: Q, B: P, C: B, depth: childDepth });
        result.push({ type: 0, A: Q, B: P, C: C, depth: childDepth });
        result.push({ type: 1, A: P, B: A, C: C, depth: childDepth });
      } else {
        // Obtuse (A is 108 apex)
        // New point P = A + (B - A) / PHI
        const P = { x: A.x + (B.x - A.x) / PHI, y: A.y + (B.y - A.y) / PHI };
        result.push({ type: 0, A: C, B: P, C: A, depth: childDepth });
        result.push({ type: 1, A: C, B: P, C: B, depth: childDepth });
      }
    });
    return result;
  }

  // 把最终深度的三角形两两配对合并成四边形，用于绘制菱形 (rhombus)
  // 或风筝/标枪 (kite & dart) 的整体轮廓，而不是逐个三角形的内部分割线。
  //
  // mode = "rhombus": 配对“同类型”且共享一条边的两个三角形 -> 还原成完整菱形
  // mode = "kitedart": 配对“不同类型”且共享一条边的两个三角形 -> 拼成风筝/标枪
  //
  // 注：这是基于共享边配对的工程实用近似实现，并非严格按经典 P2
  // 独立 deflation 规则推导的精确版本，但视觉效果是正确、好看的
  // 风筝-标枪式拼接。无法配对的三角形会原样保留，作为兜底。
  function mergeTrianglesToQuads(triangles, mode) {
    const keyOf = (p) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
    const edgeKey = (p, q) => {
      const a = keyOf(p);
      const b = keyOf(q);
      return a < b ? a + "|" + b : b + "|" + a;
    };

    const edgeMap = new Map();
    triangles.forEach((tri, idx) => {
      const { A, B, C, type, depth } = tri;
      const entries = [
        { opposite: A, p: B, q: C },
        { opposite: B, p: A, q: C },
        { opposite: C, p: A, q: B }
      ];
      entries.forEach(e => {
        const key = edgeKey(e.p, e.q);
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key).push({ idx, type, depth, opposite: e.opposite });
      });
    });

    const used = new Set();
    const quads = [];

    edgeMap.forEach(entries => {
      if (entries.length !== 2) return;
      const [e1, e2] = entries;
      if (used.has(e1.idx) || used.has(e2.idx)) return;

      const sameType = e1.type === e2.type;
      const shouldMerge = mode === "rhombus" ? sameType : !sameType;
      if (!shouldMerge) return;

      const tri1 = triangles[e1.idx];
      const sharedEdge = [tri1.A, tri1.B, tri1.C].filter(p => p !== e1.opposite);
      const [P, Q] = sharedEdge;

      used.add(e1.idx);
      used.add(e2.idx);

      const lowerIdxType = triangles[Math.min(e1.idx, e2.idx)].type;
      quads.push({
        points: [e1.opposite, P, e2.opposite, Q],
        type: sameType ? e1.type : "mixed",
        depth: e1.depth,
        kiteOrDart: mode === "kitedart" ? (lowerIdxType === 0 ? "kite" : "dart") : null
      });
    });

    triangles.forEach((tri, idx) => {
      if (!used.has(idx)) {
        quads.push({ points: [tri.A, tri.B, tri.C], type: tri.type, depth: tri.depth, kiteOrDart: null });
      }
    });

    return quads;
  }

  function draw(canvas, view, subsampling = 1) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    const animate = preset.animate || {};
    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    time += 1;

    // Initial triangles: 10 acute triangles around the center (depth 0)
    let triangles = [];
    for (let i = 0; i < 10; i++) {
      const angle1 = (i * 36 * Math.PI) / 180;
      const angle2 = ((i + 1) * 36 * Math.PI) / 180;
      const A = { x: 0, y: 0 };
      const B = { x: Math.cos(angle1), y: Math.sin(angle1) };
      const C = { x: Math.cos(angle2), y: Math.sin(angle2) };

      if (i % 2 === 0) {
        triangles.push({ type: 0, A, B, C, depth: 0 });
      } else {
        triangles.push({ type: 0, A, B: C, C: B, depth: 0 });
      }
    }

    let depth = subsampling === 1 ? preset.maxDepth : Math.min(preset.maxDepth, 4);

    // 膨胀/收缩 (inflation/deflation) 往返动画：深度随时间在 1..maxDepth 之间来回变化
    if (animate.growth === "pingpong") {
      depth = Math.min(depth, pingpongDepth(time, 1, preset.maxDepth, 50, 70));
    }

    for (let d = 0; d < depth; d++) {
      triangles = subdivide(triangles);
    }

    // 根据 tilingMode 决定渲染单元：原始三角形，或合并后的菱形/风筝-标枪四边形
    let renderUnits;
    if (preset.tilingMode === "rhombus" || preset.tilingMode === "kitedart") {
      renderUnits = mergeTrianglesToQuads(triangles, preset.tilingMode);
    } else {
      renderUnits = triangles.map(tri => ({
        points: [tri.A, tri.B, tri.C],
        type: tri.type,
        depth: tri.depth,
        kiteOrDart: null
      }));
    }

    // 旋转的五重对称中心：整体围绕 view 中心缓慢旋转
    const rotateAngle = animate.rotate ? time * (animate.rotateSpeed || 0.005) : 0;
    const cosA = Math.cos(rotateAngle);
    const sinA = Math.sin(rotateAngle);

    renderUnits.forEach((unit, index) => {
      const projected = unit.points.map(p => {
        const dx = p.x - view.centerX;
        const dy = p.y - view.centerY;
        const rx = dx * cosA - dy * sinA;
        const ry = dx * sinA + dy * cosA;
        return {
          x: (rx / scaleX) * width + width / 2,
          y: (ry / scaleY) * height + height / 2
        };
      });

      ctx.beginPath();
      ctx.moveTo(projected[0].x, projected[0].y);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i].x, projected[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = getFillColor(unit, index, preset, isDark, time);

      // 呼吸效果：透明度按“到中心的距离”做相位偏移的正弦波动，形成扩散波纹
      if (animate.breathe) {
        const cx = unit.points.reduce((s, p) => s + p.x, 0) / unit.points.length;
        const cy = unit.points.reduce((s, p) => s + p.y, 0) / unit.points.length;
        const dist = Math.hypot(cx, cy);
        const speed = animate.breatheSpeed || 0.03;
        const wave = Math.sin(time * speed - dist * 2.2);
        ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * wave);
      }

      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = preset.colors.stroke;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    PenroseTiling: {
      id: "PenroseTiling",
      get defaultView() { return { centerX: 0, centerY: 0, scale: 2.5 }; },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      // get formula() { return PRESETS[currentPresetIndex].formula; },
      // explanationUrl: "explanations/penrose_tiling.html",
    },
  };
})(window);
