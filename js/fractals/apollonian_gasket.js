(function registerApollonianGasket(global) {
  // ── Configuration Constants ──────────────────────────────────────
  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 2.1 };
  const MAX_DEPTH = 9;                // Total recursion depth for full growth
  const INTERACTION_DEPTH = 3;        // Depth used during dragging/scaling
  const GROWTH_INTERVAL_MS = 100;      // Time between drawing individual circles
  const PAUSE_BEFORE_RESTART_MS = 5000; // Delay after completion before starting over

  const PRESETS = [
    { nameKey: "apollonian_preset_symmetric",          k: [-1, 2, 2],     scale: 2.7  },
    { nameKey: "apollonian_preset_asymmetric_classic", k: [-1, 2, 3],     scale: 2.7  },
    { nameKey: "apollonian_preset_balanced",           k: [-1, 3, 3],     scale: 2.7  },
    { nameKey: "apollonian_preset_classic",            k: [-2, 3, 6],     scale: 1.5  },
    { nameKey: "apollonian_preset_radial",             k: [-2, 4, 4],     scale: 1.5  },
    { nameKey: "apollonian_preset_sparse",             k: [-3, 4, 12],    scale: 0.9  },
    { nameKey: "apollonian_preset_nested",             k: [-3, 5, 8],     scale: 0.9  },
    { nameKey: "apollonian_preset_compact",            k: [-4, 5, 20],    scale: 0.7  },
    { nameKey: "apollonian_preset_asymmetric",         k: [-6, 10, 15],   scale: 0.5  },
    { nameKey: "apollonian_preset_contrast",           k: [-10, 11, 110], scale: 0.3  },
    { nameKey: "apollonian_preset_tight",              k: [-10, 18, 23],  scale: 0.28 },
    { nameKey: "apollonian_preset_fine",               k: [-15, 24, 40],  scale: 0.2 }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let activePreset = PRESETS[currentPresetIndex];

  // ── Animation & Cache State ──────────────────────────────────────
  let timeoutId = null;
  let taskQueue = [];
  let drawnCircles = [];
  let currentView = null; // Store the latest view for the async tick to use

  /**
   * Stops active timers. 
   */
  function stopTimers() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function cleanup() {
    stopTimers();
    taskQueue = [];
    drawnCircles = [];
  }

  function randomize() {
    cleanup();
    currentPresetIndex = presetRandomizer.next();
    activePreset = PRESETS[currentPresetIndex];
    return {
      ...DEFAULT_VIEW,
      scale: activePreset.scale
    };
  }

  function reset() {
    cleanup();
  }

  function fitCanvasToDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = global.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(320, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  // Complex number helpers
  const Complex = {
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    sqrt: (a) => {
      const m = Math.sqrt(a.re * a.re + a.im * a.im);
      const re = Math.sqrt((m + a.re) / 2);
      const im = Math.sign(a.im || 1) * Math.sqrt((m - a.re) / 2);
      return { re, im };
    },
    scale: (a, s) => ({ re: a.re * s, im: a.im * s })
  };

  class Circle {
    constructor(k, c) {
      this.k = k; // Curvature
      this.c = c; // Center (Complex)
      this.r = Math.abs(1 / k);
    }
  }

  /**
   * Processes a single circle generation task.
   */
  function processCircleTask(c1, c2, c3, depth, maxDepth, ctx, width, height, isDark, queue) {
    if (!c1 || !c2 || !c3) return;
    if (depth > maxDepth) return;

    const k1 = c1.k, k2 = c2.k, k3 = c3.k;
    const disc = k1 * k2 + k2 * k3 + k3 * k1;
    if (disc < 0 && Math.abs(disc) > 1e-10) return;
    
    const k4 = k1 + k2 + k3 + 2 * Math.sqrt(Math.abs(disc));
    
    const z1 = Complex.scale(c1.c, k1);
    const z2 = Complex.scale(c2.c, k2);
    const z3 = Complex.scale(c3.c, k3);
    
    const sumZ = Complex.add(z1, Complex.add(z2, z3));
    const term2 = Complex.scale(Complex.sqrt(Complex.add(Complex.mul(z1, z2), Complex.add(Complex.mul(z2, z3), Complex.mul(z3, z1)))), 2);
    
    const centers = [
      Complex.scale(Complex.add(sumZ, term2), 1 / k4),
      Complex.scale(Complex.sub(sumZ, term2), 1 / k4)
    ];

    for (const c of centers) {
      const d1 = Math.sqrt((c.re - c1.c.re)**2 + (c.im - c1.c.im)**2);
      const d2 = Math.sqrt((c.re - c2.c.re)**2 + (c.im - c2.c.im)**2);
      const d3 = Math.sqrt((c.re - c3.c.re)**2 + (c.im - c3.c.im)**2);
      
      const r4 = 1/k4;
      const t1 = k1 < 0 ? Math.abs(d1 - (c1.r - r4)) : Math.abs(d1 - (c1.r + r4));
      const t2 = k2 < 0 ? Math.abs(d2 - (c2.r - r4)) : Math.abs(d2 - (c2.r + r4));
      const t3 = k3 < 0 ? Math.abs(d3 - (c3.r - r4)) : Math.abs(d3 - (c3.r + r4));

      if (t1 < 1e-4 && t2 < 1e-4 && t3 < 1e-4) {
        const circle = new Circle(k4, c);
        
        // Cache and render
        drawnCircles.push(circle);
        renderCircle(ctx, circle, width, height, currentView, isDark);
        
        const nextDepth = depth + 1;
        if (nextDepth <= maxDepth) {
          queue.push({ c1: c1, c2: c2, c3: circle, depth: nextDepth });
          queue.push({ c1: c2, c2: c3, c3: circle, depth: nextDepth });
          queue.push({ c1: c1, c2: c3, c3: circle, depth: nextDepth });
        }
        break;
      }
    }
  }

  function tick(ctx, width, height, isDark, maxDepth) {
    if (taskQueue.length === 0) {
      // Loop: Pause then restart
      timeoutId = setTimeout(() => {
        drawnCircles = [];
        draw(ctx.canvas, currentView, 1);
      }, PAUSE_BEFORE_RESTART_MS);
      return;
    }

    const task = taskQueue.shift();
    processCircleTask(task.c1, task.c2, task.c3, task.depth, maxDepth, ctx, width, height, isDark, taskQueue);

    timeoutId = setTimeout(() => tick(ctx, width, height, isDark, maxDepth), GROWTH_INTERVAL_MS);
  }

  function renderCircle(ctx, circle, width, height, view, isDark) {
    const aspect = width / height;
    const px = (circle.c.re - view.centerX) / (view.scale * aspect) * width + width / 2;
    const py = height / 2 - (circle.c.im - view.centerY) / view.scale * height;
    const pr = circle.r / view.scale * height;

    if (pr < 0.2) return;

    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    
    const hue = (Math.log(Math.abs(circle.k)) * 40 + 200) % 360;
    ctx.strokeStyle = isDark ? `hsla(${hue}, 70%, 60%, 0.8)` : `hsla(${hue}, 80%, 40%, 0.8)`;
    ctx.lineWidth = Math.max(0.5, pr * 0.01);
    ctx.stroke();
  }

  function draw(canvas, view, subsampling = 1) {
    stopTimers();
    currentView = view;
    fitCanvasToDisplay(canvas);
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const isDark = document.documentElement.classList.contains("theme-dark");

    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Initialization check
    if (drawnCircles.length === 0) {
      const [k1, k2, k3] = activePreset.k;
      const r1 = Math.abs(1/k1), r2 = 1/k2, r3 = 1/k3;
      const c1 = new Circle(k1, { re: 0, im: 0 });
      const c2 = new Circle(k2, { re: r1 - r2, im: 0 });
      const x3 = ((r1 - r3)**2 + (r1 - r2)**2 - (r2 + r3)**2) / (2 * (r1 - r2));
      const y3 = Math.sqrt(Math.max(0, (r1 - r3)**2 - x3**2));
      const c3 = new Circle(k3, { re: x3, im: y3 });

      drawnCircles.push(c1, c2, c3);
      taskQueue = [];

      const disc = Math.max(0, k1 * k2 + k2 * k3 + k3 * k1);
      const k4Options = [
        k1 + k2 + k3 + 2 * Math.sqrt(disc),
        k1 + k2 + k3 - 2 * Math.sqrt(disc)
      ];

      const z1 = Complex.scale(c1.c, k1), z2 = Complex.scale(c2.c, k2), z3 = Complex.scale(c3.c, k3);
      const sumZ = Complex.add(z1, Complex.add(z2, z3));
      const term2 = Complex.scale(Complex.sqrt(Complex.add(Complex.mul(z1, z2), Complex.add(Complex.mul(z2, z3), Complex.mul(z3, z1)))), 2);

      for (const k4 of k4Options) {
        if (Math.abs(k4) < 1e-6) continue;
        const centers = [
          Complex.scale(Complex.add(sumZ, term2), 1 / k4),
          Complex.scale(Complex.sub(sumZ, term2), 1 / k4)
        ];
        
        for (const c of centers) {
          const d1 = Math.sqrt((c.re - c1.c.re)**2 + (c.im - c1.c.im)**2);
          const d2 = Math.sqrt((c.re - c2.c.re)**2 + (c.im - c2.c.im)**2);
          const d3 = Math.sqrt((c.re - c3.c.re)**2 + (c.im - c3.c.im)**2);
          const r4 = Math.abs(1/k4);
          
          const t1 = k1 < 0 ? Math.abs(d1 - (c1.r - r4)) : Math.abs(d1 - (c1.r + r4));
          const t2 = k2 < 0 ? Math.abs(d2 - (c2.r - r4)) : Math.abs(d2 - (c2.r + r4));
          const t3 = k3 < 0 ? Math.abs(d3 - (c3.r - r4)) : Math.abs(d3 - (c3.r + r4));

          if (t1 < 1e-4 && t2 < 1e-4 && t3 < 1e-4) {
            // Avoid duplicates with initial circles
            const isDuplicate = drawnCircles.some(dc => 
              Math.abs(dc.k - k4) < 1e-4 && 
              Math.abs(dc.c.re - c.re) < 1e-4 && 
              Math.abs(dc.c.im - c.im) < 1e-4
            );
            if (!isDuplicate) {
              const circle = new Circle(k4, c);
              drawnCircles.push(circle);
              taskQueue.push({ c1: c1, c2: c2, c3: circle, depth: 0 });
              taskQueue.push({ c1: c1, c2: c3, c3: circle, depth: 0 });
              taskQueue.push({ c1: c2, c2: c3, c3: circle, depth: 0 });
            }
          }
        }
      }
    }

    // Always redraw everything we have calculated so far
    for (const circle of drawnCircles) {
      renderCircle(ctx, circle, width, height, view, isDark);
    }

    if (subsampling > 1) {
      // Just preview existing during interaction
      return;
    } else {
      // Resume growth
      tick(ctx, width, height, isDark, MAX_DEPTH);
    }
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    ApollonianGasket: {
      get defaultView() {
        return {
          ...DEFAULT_VIEW,
          scale: activePreset.scale
        };
      },
      draw,
      cleanup,
      randomize,
      reset,
      formula: "(∑kᵢ)² = 2∑kᵢ²",
      // explanationUrl: "explanations/apollonian_gasket.html",
      get currentNameKey() {
        return activePreset.nameKey;
      }
    },
  };
})(window);
