(function registerLevyCurve(global) {
  const PRESETS = [
    {id: "icy_feathers",       nameKey: "levy_preset_icy",                iterations: 12, colorType: "ice",     turnAngle: 45 },
    {id: "golden_bloom",       nameKey: "levy_preset_golden",             iterations: 11, colorType: "gold",    turnAngle: 45 },
    {id: "rainbow_weave",      nameKey: "levy_preset_rainbow",            iterations: 13, colorType: "rainbow", turnAngle: 45 },
    {id: "neon_phantom",       nameKey: "levy_preset_neon",               iterations: 12, colorType: "neon",    turnAngle: 45 },
    {id: "wide_arc",           nameKey: "levy_preset_wide_arc",           iterations: 13, colorType: "gold",    turnAngle: 35 },
    {id: "sharp_spires",       nameKey: "levy_preset_sharp_spires",       iterations: 11, colorType: "ice",     turnAngle: 48 },
    {id: "crimson_flow",       nameKey: "levy_preset_crimson_flow",       iterations: 13, colorType: "flow",    turnAngle: 45 },
    {id: "twisted_dragon",     nameKey: "levy_preset_twisted_dragon",     iterations: 13, colorType: "ice",     turnAngle: 45, alternate: true },
    {id: "kaleidoscope_bloom", nameKey: "levy_preset_kaleidoscope_bloom", iterations: 10, colorType: "rainbow", turnAngle: 40, mirrorCopies: 6, mirrorFlip: true }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    // 缩小为原来的0.6倍：scale越大，画面看起来越小，所以原scale除以0.6
    const baseScale = 2.5;
    const scale = baseScale / 0.6;
    // 整体向上移动10%（这里取新视野高度的10%作为偏移量），centerY增大会让图形在画布上往上移
    const centerY = 0.2 + 0.1 * scale;
    return { centerX: 0, centerY, scale };
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    const preset = PRESETS[currentPresetIndex];
    
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    time = 0;
    return calculateOptimalView(canvas);
  }

  function drawLevyLine(ctx, x1, y1, x2, y2, depth, k, alternate, side, colorType, isDark, time) {
    if (depth === 0) {
      ctx.lineTo(x2, y2);
      return;
    }

    // Lévy C Curve logic (generalized turn angle):
    // k = tan(turnAngle) / 2. When turnAngle = 45°, k = 0.5, which reproduces
    // the classic isosceles-right-triangle Lévy C curve.
    // When `alternate` is on, the left/right children fold to opposite sides
    // (sign of k flips), producing an irregular, dragon-curve-like silhouette
    // instead of the smooth, consistently-curling classic Lévy shape.
    const kk = alternate ? k * side : k;
    const xNew = (x1 + x2) / 2 + (y1 - y2) * kk;
    const yNew = (y1 + y2) / 2 + (x2 - x1) * kk;

    drawLevyLine(ctx, x1, y1, xNew, yNew, depth - 1, k, alternate, -1, colorType, isDark, time);
    drawLevyLine(ctx, xNew, yNew, x2, y2, depth - 1, k, alternate, 1, colorType, isDark, time);
  }

  // Same recursive subdivision as drawLevyLine, but collects the resulting
  // polyline points instead of drawing them directly. Used for the "flow"
  // color effect and for mirrored/kaleidoscope copies, which need the raw
  // point list so the same geometry can be reused without re-recursing.
  function collectLevyPoints(x1, y1, x2, y2, depth, k, alternate, side, points) {
    if (depth === 0) {
      points.push(x2, y2);
      return;
    }

    const kk = alternate ? k * side : k;
    const xNew = (x1 + x2) / 2 + (y1 - y2) * kk;
    const yNew = (y1 + y2) / 2 + (x2 - x1) * kk;

    collectLevyPoints(x1, y1, xNew, yNew, depth - 1, k, alternate, -1, points);
    collectLevyPoints(xNew, yNew, x2, y2, depth - 1, k, alternate, 1, points);
  }

  // Draws a small decorative "seed" icon in the top-right corner: a mini
  // version of the same Lévy curve (just a few recursion steps deep,
  // animated with a gentle breathing pulse + soft glow), plus a ring of
  // petal-like marks when the preset tiles multiple mirrored copies.
  // This is meant to read as "a tiny version of the big picture" rather
  // than as a technical before/after diagram, so it works without any
  // math background — it just looks like a glowing little ornament.
  function drawGenerationIcon(ctx, cx, cy, preset, isDark, iconColor, time) {
    const turnAngle = preset.turnAngle ?? 45;
    const k = Math.tan((turnAngle * Math.PI) / 180) / 2;
    const alternate = !!preset.alternate;
    const mirrorCopies = Math.max(1, preset.mirrorCopies || 1);
    const mirrorFlip = !!preset.mirrorFlip;
    const radius = 34;
    const miniDepth = 4; // shallow recursion — just enough to read as "the same shape", not a full render

    // Gentle pulse so the icon feels alive without being distracting.
    const pulse = 0.9 + 0.1 * Math.sin(time * 1.3);

    ctx.save();
    ctx.translate(cx, cy);

    // Soft circular backing plate so the icon stays legible over a busy curve.
    ctx.beginPath();
    ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "rgba(5, 6, 7, 0.55)" : "rgba(248, 250, 252, 0.7)";
    ctx.fill();

    // Outer glow halo behind the mini curve.
    ctx.save();
    ctx.shadowColor = iconColor;
    ctx.shadowBlur = 10 * pulse;

    // Build the mini curve's points once, scaled to fit inside the icon circle.
    const half = radius * 0.62;
    const miniPoints = [-half, 0];
    collectLevyPoints(-half, 0, half, 0, miniDepth, k, alternate, 1, miniPoints);

    const copies = mirrorCopies > 1 ? mirrorCopies : 1;
    for (let m = 0; m < copies; m++) {
      ctx.save();
      ctx.rotate((2 * Math.PI * m) / copies);
      if (mirrorFlip && m % 2 === 1) ctx.scale(1, -1);
      ctx.scale(pulse, pulse);

      ctx.beginPath();
      ctx.moveTo(miniPoints[0], miniPoints[1]);
      for (let i = 2; i < miniPoints.length; i += 2) {
        ctx.lineTo(miniPoints[i], miniPoints[i + 1]);
      }
      ctx.strokeStyle = iconColor;
      ctx.lineWidth = copies > 1 ? 1.3 : 1.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore(); // end glow

    // A faint ring of small petal dashes hints at "this repeats N times
    // around" for mirrored/kaleidoscope presets, without technical labels.
    if (copies > 1) {
      for (let i = 0; i < copies; i++) {
        const a = (Math.PI * 2 * i) / copies;
        const px = Math.cos(a) * (radius + 2);
        const py = Math.sin(a) * (radius + 2);
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "rgba(226, 232, 240, 0.55)" : "rgba(30, 41, 59, 0.45)";
        ctx.fill();
      }
    }

    ctx.restore();
  }  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.02;

    const aspect = width / height;
    const scaleX = view.scale * aspect;
    const scaleY = view.scale;

    // Base line coordinates in math units
    const x1 = -1.0;
    const y1 = 0.0;
    const x2 = 1.0;
    const y2 = 0.0;

    const toPxX = (x) => (x - view.centerX) / scaleX * width + width / 2;
    const toPxY = (y) => (y - view.centerY) / scaleY * height + height / 2;

    const px1 = toPxX(x1);
    const py1 = toPxY(y1);
    const px2 = toPxX(x2);
    const py2 = toPxY(y2);

    // Turn-angle factor: k = tan(turnAngle) / 2. Defaults to 45° (classic Lévy curve).
    const turnAngle = preset.turnAngle ?? 45;
    const k = Math.tan((turnAngle * Math.PI) / 180) / 2;
    const alternate = !!preset.alternate;

    // Animate the recursion depth slightly for "growing" effect
    const currentDepth = Math.floor(preset.iterations * (0.8 + 0.2 * Math.sin(time * 0.5)));

    // The curve's geometry only depends on the preset + time, not on which
    // mirrored/rotated copy we're drawing, so compute the polyline once and
    // reuse it for every copy below instead of re-running the recursion.
    const points = [px1, py1];
    collectLevyPoints(px1, py1, px2, py2, currentDepth, k, alternate, 1, points);
    const totalSegments = points.length / 2 - 1;

    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Mirror/kaleidoscope tiling: draw the same curve N times, rotated evenly
    // around the canvas center, optionally flipping every other copy to get
    // a symmetric, snowflake-like pattern instead of a single curve.
    const mirrorCopies = Math.max(1, preset.mirrorCopies || 1);
    const mirrorFlip = !!preset.mirrorFlip;

    for (let m = 0; m < mirrorCopies; m++) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate((2 * Math.PI * m) / mirrorCopies);
      if (mirrorFlip && m % 2 === 1) ctx.scale(-1, 1);
      ctx.translate(-width / 2, -height / 2);

      if (preset.colorType === "flow") {
        // "Flow" effect: color flows along the path based on each point's
        // position in the curve, animated over time. This needs per-segment
        // coloring, so we stroke the precomputed points in chunks (rather
        // than one continuous path) to keep the number of draw calls low.
        const chunkCount = Math.min(totalSegments, 80);
        const chunkSize = totalSegments / chunkCount;

        for (let c = 0; c < chunkCount; c++) {
          const startIdx = Math.floor(c * chunkSize);
          const endIdx = Math.min(totalSegments, Math.floor((c + 1) * chunkSize));
          if (endIdx <= startIdx) continue;

          const progress = (startIdx + endIdx) / 2 / totalSegments;
          ctx.beginPath();
          ctx.moveTo(points[startIdx * 2], points[startIdx * 2 + 1]);
          for (let i = startIdx + 1; i <= endIdx; i++) {
            ctx.lineTo(points[i * 2], points[i * 2 + 1]);
          }
          ctx.strokeStyle = `hsla(${(progress * 280 + time * 40) % 360}, 90%, 60%, 1)`;
          ctx.stroke();
        }
      } else {
        // Dynamic color logic
        let color;
        if (preset.colorType === "ice") {
          color = isDark ? "#a5f3fc" : "#0891b2";
        } else if (preset.colorType === "gold") {
          color = "#fbbf24";
        } else if (preset.colorType === "neon") {
          color = `hsla(${(time * 50) % 360}, 100%, 60%, 1)`;
        } else if (preset.colorType === "rainbow") {
          const grad = ctx.createLinearGradient(px1, py1, px2, py2);
          grad.addColorStop(0, `hsla(${time * 30 % 360}, 80%, 60%, 1)`);
          grad.addColorStop(1, `hsla(${(time * 30 + 180) % 360}, 80%, 60%, 1)`);
          color = grad;
        } else {
          // Fallback so strokeStyle is never left undefined if a new colorType
          // is added to PRESETS without a matching branch here.
          color = isDark ? "#cbd5e1" : "#475569";
        }

        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 1; i <= totalSegments; i++) {
          ctx.lineTo(points[i * 2], points[i * 2 + 1]);
        }
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Show the generation source as a mini diagram in the bottom-left corner:
    // the actual fold rule (turn angle / alternate) and, if mirrored, how
    // many tiled copies make up the full pattern.
    let iconColor;
    if (preset.colorType === "ice") {
      iconColor = isDark ? "#a5f3fc" : "#0891b2";
    } else if (preset.colorType === "gold") {
      iconColor = "#fbbf24";
    } else if (preset.colorType === "neon") {
      iconColor = `hsla(${(time * 50) % 360}, 100%, 60%, 1)`;
    } else if (preset.colorType === "rainbow") {
      iconColor = `hsla(${(time * 30) % 360}, 80%, 60%, 1)`;
    } else if (preset.colorType === "flow") {
      iconColor = `hsla(${(time * 40) % 360}, 90%, 60%, 1)`;
    } else {
      iconColor = isDark ? "#cbd5e1" : "#475569";
    }
    drawGenerationIcon(ctx, width - 44, 44, preset, isDark, iconColor, time);

    animationId = requestAnimationFrame(() => tick(canvas, view));
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
      
      const width = canvas.width;
      const height = canvas.height;
      const aspect = width / height;
      const scaleX = view.scale * aspect;
      const scaleY = view.scale;
      
      const px1 = (-1.0 - view.centerX) / scaleX * width + width / 2;
      const py1 = (0.0 - view.centerY) / scaleY * height + height / 2;
      const px2 = (1.0 - view.centerX) / scaleX * width + width / 2;
      const py2 = (0.0 - view.centerY) / scaleY * height + height / 2;

      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.strokeStyle = isDark ? "#cbd5e1" : "#475569";
      ctx.lineWidth = 1;
      drawLevyLine(ctx, px1, py1, px2, py2, 8, 0.5, false, 1, "static", isDark, time);
      ctx.stroke();
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    LevyCurve: {
      id: "LevyCurve",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      /*
      get formula() { 
        return PRESETS[currentPresetIndex].formula;
      },
      */
      // explanationUrl: "explanations/levy_curve.html",
    },
  };
})(window);
