(function registerLangtonsAnt(global) {
  const PRESETS = [
    { rules: "RL",         nameKey: "langtons_ant_preset_classic", limit: 20000,   stepsPerFrame: 10  },
    { rules: "LLRR",       nameKey: "langtons_ant_preset_highway", limit: 2000000, stepsPerFrame: 500 },
    { rules: "LRRRRRLLR",  nameKey: "langtons_ant_preset_star",    limit: 600000,  stepsPerFrame: 100 },
    { rules: "RLLR",       nameKey: "langtons_ant_preset_diamond", limit: 600000,  stepsPerFrame: 100 },
    { rules: "RRLLLRLLRR", nameKey: "langtons_ant_preset_multi",   limit: 600000,  stepsPerFrame: 100 }
  ];

  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 200 };

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let rules = PRESETS[currentPresetIndex].rules;
  let grid = new Map();
  let antX = 0, antY = 0, antDir = 0; // 0: Up, 1: Right, 2: Down, 3: Left
  let steps = 0;
  let animationId = null;
  let colors = [];

  function generateColors(num) {
    const palette = [];
    for (let i = 0; i < num; i++) {
      const hue = (i * (360 / num)) % 360;
      palette.push(`hsl(${hue}, 70%, 50%)`);
    }
    return palette;
  }

  function reset() {
    grid.clear();
    antX = 0;
    antY = 0;
    antDir = 0;
    steps = 0;
    colors = generateColors(rules.length);
  }

  let timeoutId = null;

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    grid.clear();
  }

  function randomize(canvas) {
    currentPresetIndex = presetRandomizer.next();
    rules = PRESETS[currentPresetIndex].rules;
    reset();
    
    return { ...DEFAULT_VIEW };
  }

  function fitCanvasToDisplay(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = global.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * ratio));
    const height = Math.max(320, Math.floor(rect.height * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  function step() {
    const key = `${antX},${antY}`;
    let state = grid.get(key) || 0;
    
    const turn = rules[state];
    if (turn === 'R') {
      antDir = (antDir + 1) % 4;
    } else {
      antDir = (antDir + 3) % 4;
    }

    state = (state + 1) % rules.length;
    grid.set(key, state);

    if (antDir === 0) antY--;
    else if (antDir === 1) antX++;
    else if (antDir === 2) antY++;
    else if (antDir === 3) antX--;

    steps++;
  }

  function tick(canvas, view) {
    const current = PRESETS[currentPresetIndex];
    const limit = current.limit;
    if (limit && steps >= limit) {
      cleanup();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        reset();
        draw(canvas, view);
      }, 5000);
      return;
    }

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    
    // view.scale is the height of the viewport in grid units
    const currentCellSize = height / view.scale;
    
    const stepsPerFrame = current.stepsPerFrame;
    for (let i = 0; i < stepsPerFrame; i++) {
      const oldX = antX;
      const oldY = antY;
      const key = `${oldX},${oldY}`;
      
      step();

      // Draw the old square with its new color
      const newState = grid.get(key);
      ctx.fillStyle = colors[newState];
      
      const px = (oldX - view.centerX) * currentCellSize + width / 2;
      const py = (oldY - view.centerY) * currentCellSize + height / 2;
      
      // Only draw if within bounds
      if (px >= -currentCellSize && px <= width && py >= -currentCellSize && py <= height) {
        ctx.fillRect(px, py, Math.ceil(currentCellSize), Math.ceil(currentCellSize));
      }
      
      if (limit && steps >= limit) break;
    }

    animationId = requestAnimationFrame(() => tick(canvas, view));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    fitCanvasToDisplay(canvas);
    
    const ctx = canvas.getContext("2d");
    const isDark = document.documentElement.classList.contains("theme-dark");
    ctx.fillStyle = isDark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const currentCellSize = height / view.scale;

    // Draw existing grid
    grid.forEach((state, key) => {
      const [x, y] = key.split(',').map(Number);
      ctx.fillStyle = colors[state];
      const px = (x - view.centerX) * currentCellSize + width / 2;
      const py = (y - view.centerY) * currentCellSize + height / 2;
      if (px >= -currentCellSize && px <= width && py >= -currentCellSize && py <= height) {
        ctx.fillRect(px, py, Math.ceil(currentCellSize), Math.ceil(currentCellSize));
      }
    });

    if (subsampling === 1) {
      animationId = requestAnimationFrame(() => tick(canvas, view));
    }
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    LangtonsAnt: {
      id: "LangtonsAnt",
      defaultView: DEFAULT_VIEW,
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw,
      cleanup,
      randomize,
      reset,
      // explanationUrl: "explanations/langtons_ant.html",
    },
  };
  
  colors = generateColors(rules.length);
})(window);
