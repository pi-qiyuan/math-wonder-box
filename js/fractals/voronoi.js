(function registerVoronoiDiagram(global) {
  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 1.0 };
  const MAX_POINTS = 64; // Uniform array size limit in many mobile GPUs

  const PRESETS = [
    { id: "mosaic",   nameKey: "voronoi_preset_mosaic",   mode: 0, points: 40 },
    { id: "cellular", nameKey: "voronoi_preset_cellular", mode: 1, points: 30 },
    { id: "nodes",    nameKey: "voronoi_preset_nodes",    mode: 2, points: 50 },
    { id: "shards",   nameKey: "voronoi_preset_shards",   mode: 3, points: 45 }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  
  let points = new Float32Array(MAX_POINTS * 2);
  let velocities = new Float32Array(MAX_POINTS * 2);
  let pointColors = new Float32Array(MAX_POINTS * 3);
  
  let gl = null;
  let program = null;
  let vertShader = null;
  let fragShader = null;
  let vertexBuffer = null;
  let uLoc = {};
  let animationId = null;
  let lastFrameTime = 0;

  function initPoints(count) {
    for (let i = 0; i < MAX_POINTS; i++) {
      points[i * 2] = (Math.random() - 0.5) * 2.5;
      points[i * 2 + 1] = (Math.random() - 0.5) * 2.5;
      
      const speed = 0.002 + Math.random() * 0.003;
      const angle = Math.random() * Math.PI * 2;
      velocities[i * 2] = Math.cos(angle) * speed;
      velocities[i * 2 + 1] = Math.sin(angle) * speed;

      // Generate a nice palette
      const hue = (i / count + Math.random() * 0.1) % 1.0;
      const rgb = hsvToRgb(hue, 0.6, 0.8);
      pointColors[i * 3] = rgb[0];
      pointColors[i * 3 + 1] = rgb[1];
      pointColors[i * 3 + 2] = rgb[2];
    }
  }

  function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
    return [r, g, b];
  }

  const VERT_SRC = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG_SRC = `
    precision mediump float;
    #define MAX_POINTS ${MAX_POINTS}
    uniform vec2 u_points[MAX_POINTS];
    uniform vec3 u_colors[MAX_POINTS];
    uniform int u_count;
    uniform int u_mode;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform vec2 u_resolution;
    uniform bool u_isDark;
    varying vec2 v_uv;

    void main() {
      float aspect = u_resolution.x / u_resolution.y;
      vec2 st = (v_uv - 0.5) * u_scale;
      st.x *= aspect;
      st += u_center;

      float minDist = 100.0;
      float secondMinDist = 100.0;
      vec3 color = vec3(0.0);

      for (int i = 0; i < MAX_POINTS; i++) {
        if (i >= u_count) break;
        float d = distance(st, u_points[i]);
        if (d < minDist) {
          secondMinDist = minDist;
          minDist = d;
          color = u_colors[i];
        } else if (d < secondMinDist) {
          secondMinDist = d;
        }
      }
      
      if (u_mode == 0) { // Mosaic
        // Standard Voronoi cells
        float edge = smoothstep(0.0, 0.02 * u_scale, secondMinDist - minDist);
        color *= (0.8 + 0.2 * edge);
      } else if (u_mode == 1) { // Cellular (Worley)
        float val = minDist * 2.0 / u_scale;
        color = mix(color, vec3(0.0), val);
      } else if (u_mode == 2) { // Nodes
        float node = smoothstep(0.04 * u_scale, 0.0, minDist);
        float line = smoothstep(0.01 * u_scale, 0.0, secondMinDist - minDist);
        vec3 bg = u_isDark ? vec3(0.05) : vec3(0.95);
        color = mix(bg, color, node + line * 0.5);
      } else if (u_mode == 3) { // Shards
        float shard = fract(minDist * 10.0 / u_scale);
        color = color * (0.6 + 0.4 * shard);
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function initGL(canvas) {
    const ctx = canvas.getContext("webgl", { antialias: false, alpha: false })
              || canvas.getContext("experimental-webgl", { antialias: false, alpha: false });
    if (!ctx) return false;
    gl = ctx;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Voronoi shader error:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    vertShader = compile(gl.VERTEX_SHADER, VERT_SRC);
    fragShader = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vertShader || !fragShader) {
      gl = null;
      return false;
    }

    program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Voronoi program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      program = null;
      gl = null;
      return false;
    }
    
    gl.useProgram(program);

    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,-1, 1,1, -1,1]);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uLoc = {
      points: gl.getUniformLocation(program, "u_points"),
      colors: gl.getUniformLocation(program, "u_colors"),
      count: gl.getUniformLocation(program, "u_count"),
      mode: gl.getUniformLocation(program, "u_mode"),
      center: gl.getUniformLocation(program, "u_center"),
      scale: gl.getUniformLocation(program, "u_scale"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      isDark: gl.getUniformLocation(program, "u_isDark")
    };
    return true;
  }

  function updatePoints() {
    const preset = PRESETS[currentPresetIndex];
    const count = preset.points;
    for (let i = 0; i < count; i++) {
      points[i * 2] += velocities[i * 2];
      points[i * 2 + 1] += velocities[i * 2 + 1];

      // Bounce
      if (Math.abs(points[i * 2]) > 2.0) velocities[i * 2] *= -1;
      if (Math.abs(points[i * 2 + 1]) > 2.0) velocities[i * 2 + 1] *= -1;
    }
  }

  function renderFrame(canvas, view) {
    if (!gl && !initGL(canvas)) return;
    
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(program);

    const preset = PRESETS[currentPresetIndex];
    const isDark = document.documentElement.classList.contains("theme-dark");

    gl.uniform2fv(uLoc.points, points);
    gl.uniform3fv(uLoc.colors, pointColors);
    gl.uniform1i(uLoc.count, preset.points);
    gl.uniform1i(uLoc.mode, preset.mode);
    gl.uniform2f(uLoc.center, view.centerX, view.centerY);
    gl.uniform1f(uLoc.scale, view.scale * 2.0);
    gl.uniform2f(uLoc.resolution, canvas.width, canvas.height);
    gl.uniform1i(uLoc.isDark, isDark ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(canvas, view, timestamp) {
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < 16) {
      animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
      return;
    }
    lastFrameTime = timestamp;

    updatePoints();
    renderFrame(canvas, view);
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

  function draw(canvas, view, subsampling = 1) {
    cleanup();
    if (points[0] === 0 && points[1] === 0) {
      initPoints(PRESETS[currentPresetIndex].points);
    }
    lastFrameTime = 0;
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

  function cleanup() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (gl) {
      if (program) { gl.deleteProgram(program); program = null; }
      if (vertShader) { gl.deleteShader(vertShader); vertShader = null; }
      if (fragShader) { gl.deleteShader(fragShader); fragShader = null; }
      if (vertexBuffer) { gl.deleteBuffer(vertexBuffer); vertexBuffer = null; }
    }
    gl = null;
    uLoc = {};
  }

  function randomize() {
    currentPresetIndex = presetRandomizer.next();
    initPoints(PRESETS[currentPresetIndex].points);
    return DEFAULT_VIEW;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Voronoi: {
      id: "Voronoi",
      defaultView: DEFAULT_VIEW,
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw, cleanup, randomize,
      formula: "d(P, Sᵢ) = minⱼ d(P, Sⱼ)",
      // explanationUrl: "explanations/voronoi.html",
    },
  };
})(window);
