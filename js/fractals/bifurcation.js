(function registerBifurcation(global) {
  const PRESETS = [
    { id: "classic_chaos",  nameKey: "bifurcation_preset_classic_chaos",  centerX: 3.2, centerY: 0.5, scale: 1.6, colorType: "emerald",    mapType: "logistic",          domainLo: 0,   domainHi: 4,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n])" },
    { id: "golden_branch",  nameKey: "bifurcation_preset_golden_branch",  centerX: 3.2, centerY: 0.5, scale: 1.6, colorType: "gold-purple", mapType: "logistic",         domainLo: 0,   domainHi: 4,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n])" },
    { id: "prismatic_fork", nameKey: "bifurcation_preset_prismatic_fork", centerX: 3.2, centerY: 0.5, scale: 1.6, colorType: "rainbow",    mapType: "logistic",          domainLo: 0,   domainHi: 4,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n])" },
    { id: "nebula_zoom",    nameKey: "bifurcation_preset_nebula_zoom",    centerX: 0.5, centerY: 0.5, scale: 1.5, colorType: "nebula",     mapType: "pomeau_manneville", domainLo: 0,   domainHi: 1,    x0: 0.4, mapZ: 2.5, formula: "x[n+1] = (x[n] + r·x[n]^2.5) mod 1" },
    { id: "fire_fringe",    nameKey: "bifurcation_preset_fire_fringe",    centerX: 3.2, centerY: 0.5, scale: 1.6, colorType: "fire",       mapType: "logistic",          domainLo: 0,   domainHi: 4,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n])" },
    { id: "violet_cascade", nameKey: "bifurcation_preset_violet_cascade", centerX: 3.2, centerY: 0.5, scale: 1.6, colorType: "violet",     mapType: "logistic",          domainLo: 0,   domainHi: 4,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n])" },
    { id: "tent_lines",     nameKey: "bifurcation_preset_tent_lines",     centerX: 1.5, centerY: 0.5, scale: 1.0, colorType: "ice",        mapType: "tent",              domainLo: 0,   domainHi: 2,    x0: 0.5, formula: "x[n+1] = r·min(x[n], 1 - x[n])" },
    { id: "sine_drift",     nameKey: "bifurcation_preset_sine_drift",     centerX: 0.5, centerY: 0.5, scale: 1.0, colorType: "coral",      mapType: "sine",              domainLo: 0,   domainHi: 1,    x0: 0.5, formula: "x[n+1] = r·sin(π·x[n])" },
    { id: "gauss_pool",     nameKey: "bifurcation_preset_gauss_pool",     centerX: 7.0, centerY: 0.0, scale: 6.0, colorType: "lagoon",     mapType: "gauss",             domainLo: 0,   domainHi: 20,   x0: 0.0, mapBeta: -0.5, formula: "x[n+1] = exp(-r·x[n]²) - 0.5" },
    { id: "cubic_split",    nameKey: "bifurcation_preset_cubic_split",    centerX: 2.5, centerY: 0.0, scale: 2.0, colorType: "amber",      mapType: "cubic",             domainLo: 0,   domainHi: 3,    x0: 0.5, formula: "x[n+1] = r·x[n](1 - x[n]²)" },
    { id: "henon_shadow",   nameKey: "bifurcation_preset_henon_shadow",   centerX: 1.2, centerY: 0.0, scale: 2.5, colorType: "ember",      mapType: "henon",             domainLo: 0.9, domainHi: 1.41, x0: 0.1, y0: 0.1, mapB: 0.3, formula: "x[n+1] = 1 - r·x[n]² + y[n], y[n+1] = 0.3·x[n]" }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  function calculateOptimalView(canvas) {
    const p = PRESETS[currentPresetIndex];
    return { centerX: p.centerX, centerY: p.centerY, scale: p.scale };
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

    return calculateOptimalView(canvas);
  }

  function drawBifurcationScene(ctx, width, height, view, preset, time, isDark, subsampling) {
    const aspect = width / height;
    const rMin = view.centerX - view.scale / 2;
    const rMax = view.centerX + view.scale / 2;
    
    // For Y mapping
    const yMin = view.centerY - (view.scale / aspect) / 2;
    const yMax = view.centerY + (view.scale / aspect) / 2;
    
    const xRes = subsampling === 1 ? width : width / 2;
    const iterations = subsampling === 1 ? 150 : 60;
    const skip = 100;
    
    const opacity = 0.4 + 0.3 * Math.sin(time * 0.8);
    
    const rLo = preset.domainLo ?? 0;
    const rHi = preset.domainHi ?? 4;

    for (let i = 0; i < xRes; i++) {
      const r = rMin + (i / xRes) * (rMax - rMin);
      if (r < rLo || r > rHi) continue;

      let x = preset.x0 ?? 0.5;
      let y = preset.y0 ?? 0;
      
      let color;
      if (preset.colorType === "rainbow") {
        color = `hsla(${(i + time * 60) % 360}, 80%, ${isDark ? 65 : 45}%, ${opacity})`;
      } else if (preset.colorType === "emerald") {
        color = `hsla(160, 80%, ${isDark ? 60 : 40}%, ${opacity})`;
      } else if (preset.colorType === "gold-purple") {
        color = i % 2 === 0 ? `hsla(45, 90%, ${isDark ? 65 : 45}%, ${opacity})` : `hsla(280, 80%, ${isDark ? 55 : 35}%, ${opacity})`;
      } else if (preset.colorType === "nebula") {
        color = `hsla(${(280 + (i/xRes) * 60 + time * 20) % 360}, 85%, ${isDark ? 65 : 45}%, ${opacity})`;
      } else if (preset.colorType === "fire") {
        color = `hsla(${(10 + (i/xRes) * 40 + time * 30) % 360}, 95%, ${isDark ? 70 : 50}%, ${opacity})`;
      } else if (preset.colorType === "violet") {
        color = `hsla(${(260 + Math.sin(time) * 20) % 360}, 70%, ${isDark ? 70 : 40}%, ${opacity})`;
      } else if (preset.colorType === "ice") {
        color = `hsla(${(195 + (i/xRes) * 25) % 360}, 80%, ${isDark ? 70 : 50}%, ${opacity})`;
      } else if (preset.colorType === "coral") {
        color = `hsla(${(350 + Math.sin(time * 0.5) * 15) % 360}, 75%, ${isDark ? 65 : 50}%, ${opacity})`;
      } else if (preset.colorType === "lagoon") {
        color = `hsla(${(175 + (i/xRes) * 30 + time * 10) % 360}, 70%, ${isDark ? 60 : 40}%, ${opacity})`;
      } else if (preset.colorType === "amber") {
        color = `hsla(${(40 + (i/xRes) * 20) % 360}, 85%, ${isDark ? 65 : 45}%, ${opacity})`;
      } else if (preset.colorType === "ember") {
        color = `hsla(${(20 + Math.sin(time) * 25) % 360}, 90%, ${isDark ? 65 : 45}%, ${opacity})`;
      }

      ctx.fillStyle = color;
      // Iterate the chosen map; each preset declares its own mapType
      const z = preset.mapZ || 2.5;
      const beta = preset.mapBeta ?? -0.5;
      const b = preset.mapB ?? 0.3;
      const px = (i / xRes) * width;
      for (let n = 0; n < skip + iterations; n++) {
        switch (preset.mapType) {
          case "pomeau_manneville":
            x = (x + r * Math.pow(x, z)) % 1;
            break;
          case "tent":
            x = r * Math.min(x, 1 - x);
            break;
          case "sine":
            x = r * Math.sin(Math.PI * x);
            break;
          case "gauss":
            x = Math.exp(-r * x * x) + beta;
            break;
          case "cubic":
            x = r * x * (1 - x * x);
            break;
          case "henon": {
            const nextX = 1 - r * x * x + y;
            y = b * x;
            x = nextX;
            break;
          }
          default: // logistic
            x = r * x * (1 - x);
        }
        if (n >= skip) {
          // Map x to canvas Y using view.centerY and view.scale
          const py = ((yMax - x) / (yMax - yMin)) * height;

          if (py >= 0 && py < height) {
              if (subsampling === 1) {
                ctx.fillRect(px, py, 1, 1);
              } else {
                ctx.fillRect(px, py, 2, 2);
              }
          }
        }
      }
    }
  }

  function tick(canvas, view) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    const preset = PRESETS[currentPresetIndex];
    time += 0.01;

    drawBifurcationScene(ctx, width, height, view, preset, time, isDark, 1);

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    } else {
      const width = canvas.width;
      const height = canvas.height;
      const preset = PRESETS[currentPresetIndex];
      ctx.fillStyle = isDark ? "#050607" : "#f8fafc";
      ctx.fillRect(0, 0, width, height);
      drawBifurcationScene(ctx, width, height, view, preset, time, isDark, subsampling);
    }
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Bifurcation: {
      id: "Bifurcation",
      get defaultView() { return calculateOptimalView(document.getElementById("mandelbrotCanvas")); },
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      get formula() { 
        return PRESETS[currentPresetIndex].formula;
      },
      // explanationUrl: "explanations/bifurcation.html",
    },
  };
})(window);
