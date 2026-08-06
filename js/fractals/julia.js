(function registerJuliaSet(global) {
  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 3.0, };

  const PRESETS = [
    { id: "golden",      real: -0.8,    imag:  0.156,  driftAmount: 0.008, nameKey: "julia_preset_golden"      },
    { id: "dendrite",    real:  0,      imag:  0.8,    driftAmount: 0.003, nameKey: "julia_preset_dendrite"    },
    { id: "rabbit",      real: -0.123,  imag:  0.745,  driftAmount: 0.012, nameKey: "julia_preset_rabbit"      },
    { id: "sanmarco",    real: -0.75,   imag:  0,      driftAmount: 0.005, nameKey: "julia_preset_sanmarco"    },
    { id: "siegel",      real: -0.391,  imag:  0.587,  driftAmount: 0.007, nameKey: "julia_preset_siegel"      },
    { id: "cauliflower", real:  0.285,  imag:  0.01,   driftAmount: 0.006, nameKey: "julia_preset_cauliflower" },
    { id: "clouds",      real: -0.4,    imag:  0.6,    driftAmount: 0.01,  nameKey: "julia_preset_clouds"      },
    { id: "galaxy",      real: -0.7269, imag:  0.1889, driftAmount: 0.015, nameKey: "julia_preset_galaxy"      }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  let time = 0;
  let animationId = null;

  // ── WebGL 状态（懒初始化，第一次 draw 时建立）──────────────────────────────
  let gl = null;        // WebGLRenderingContext
  let program = null;   // 着色器程序
  let vertShader = null;
  let fragShader = null;
  let vertexBuffer = null;
  let uLoc = {};        // uniform 位置缓存

  // ── Vertex shader ─────────────────────────────────────────────────────────
  // 全屏三角形，不需要 VBO，直接用 gl_VertexID 计算顶点坐标
  // （WebGL 1.0 没有 gl_VertexID，用属性代替）
  const VERT_SRC = `
    attribute vec2 a_pos;
    varying   vec2 v_uv;
    void main() {
      v_uv        = a_pos * 0.5 + 0.5;   // [0,1]
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  // ── Fragment shader ────────────────────────────────────────────────────────
  // 每像素独立执行，完全在 GPU 上完成 Julia 集迭代和着色。
  // CPU 只负责传递 6 个 uniform（c, view, maxIter, time），其余全部并行。
  //
  // 着色策略：
  //   smooth coloring  — 消除整数等值线产生的硬色带
  //   orbit-trap tint  — 叠加一层基于轨道到原点距离的暖色晕，
  //                      让深色区域不是纯黑，增加层次感
  //   8 锚点调色板      — 深蓝→蓝→白→金→橙→紫→深蓝 循环
  //
  // 精度说明：mediump 在大多数 GPU 上约 16bit，对 Julia 集默认缩放够用。
  // 如果深度缩放出现精度噪点，可改为 highp（移动端可能不支持，需要检测）。
  const FRAG_SRC = `
    precision mediump float;

    uniform vec2  u_c;           // Julia 参数 c = (real, imag)
    uniform vec2  u_center;      // 视口中心
    uniform float u_scale;       // 视口半径（复平面单位）
    uniform int   u_maxIter;     // 最大迭代次数
    uniform float u_time;        // 动画时间（用于色彩偏移，可选）
    uniform vec2  u_resolution;  // canvas 像素尺寸

    varying vec2 v_uv;

    // ── 调色板：8 锚点，cubic hermite 平滑插值 ──────────────────────────────
    // 比线性插值颜色过渡更自然，几乎无额外计算成本
    vec3 palette(float t) {
      // 8 个颜色锚点
      vec3 p[8];
      p[0] = vec3(0.008, 0.008, 0.063);  // 深蓝黑
      p[1] = vec3(0.098, 0.196, 0.706);  // 深蓝
      p[2] = vec3(0.353, 0.667, 1.000);  // 亮蓝
      p[3] = vec3(1.000, 1.000, 1.000);  // 白色峰
      p[4] = vec3(1.000, 0.824, 0.235);  // 金黄
      p[5] = vec3(0.863, 0.314, 0.039);  // 橙红
      p[6] = vec3(0.392, 0.039, 0.314);  // 深紫
      p[7] = vec3(0.008, 0.008, 0.063);  // 回深蓝黑（闭合循环）

      float s  = t * 7.0;
      int   i  = int(s);
      float f  = s - float(i);
      // cubic smooth step（smoothstep 替换线性 f，减少色带感）
      float ff = f * f * (3.0 - 2.0 * f);

      // GLSL 1.0 不支持动态数组索引，手动展开
      vec3 c0, c1;
      if      (i == 0) { c0 = p[0]; c1 = p[1]; }
      else if (i == 1) { c0 = p[1]; c1 = p[2]; }
      else if (i == 2) { c0 = p[2]; c1 = p[3]; }
      else if (i == 3) { c0 = p[3]; c1 = p[4]; }
      else if (i == 4) { c0 = p[4]; c1 = p[5]; }
      else if (i == 5) { c0 = p[5]; c1 = p[6]; }
      else             { c0 = p[6]; c1 = p[7]; }
      return mix(c0, c1, ff);
    }

    void main() {
      // ── 像素坐标 → 复平面坐标 ─────────────────────────────────────────────
      float aspect = u_resolution.x / u_resolution.y;
      vec2 uv = v_uv - 0.5;                          // [-0.5, 0.5]
      vec2 z  = vec2(uv.x * u_scale * aspect,
                     uv.y * u_scale) + u_center;

      // ── Julia 迭代 ────────────────────────────────────────────────────────
      float iter     = 0.0;
      float escaped  = 0.0;   // 逃逸时 |z|²，用于 smooth coloring
      bool  inside   = true;
      float minDist2 = 1e9;   // orbit trap：轨道到原点的最近距离²

      for (int n = 0; n < 512; n++) {
        if (n >= u_maxIter) break;
        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;
        float r2  = zx2 + zy2;
        minDist2  = min(minDist2, r2);  // orbit trap 记录

        if (r2 > 4.0) {
          escaped = r2;
          inside  = false;
          break;
        }
        z = vec2(zx2 - zy2 + u_c.x,
                 2.0 * z.x * z.y + u_c.y);
        iter += 1.0;
      }

      // ── 内部点：深色 + 轻微 orbit-trap 晕染 ──────────────────────────────
      if (inside) {
        // 用 minDist2 给内部结构添加一点纹理，而非纯黑
        float glow = exp(-minDist2 * 12.0) * 0.18;
        gl_FragColor = vec4(glow * 0.4, glow * 0.2, glow * 0.8, 1.0);
        return;
      }

      // ── smooth iteration count ────────────────────────────────────────────
      // 标准公式：消除等值线硬边（需要逃逸时 |z|² > 0）
      float log2z  = log(escaped) * 0.5 / log(2.0);   // log2(|z|)
      float smooth = iter + 1.5 - log2(max(log2z, 0.5));
      float t      = fract(smooth * 0.022);            // 调色板采样位置

      vec3 col = palette(t);

      // ── orbit-trap 暖色叠加 ───────────────────────────────────────────────
      // 给接近逃逸边界的区域加一层细微的暖光，增强层次感
      float trapGlow = exp(-minDist2 * 3.0) * 0.12;
      col += vec3(trapGlow * 0.8, trapGlow * 0.4, 0.0);
      col  = clamp(col, 0.0, 1.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // ── WebGL 初始化 ──────────────────────────────────────────────────────────
  function initGL(canvas) {
    // 优先 webgl，回退 experimental-webgl（Safari 老版本）
    const ctx = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true })
              || canvas.getContext("experimental-webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!ctx) return false;
    gl = ctx;

    // 编译着色器
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Julia shader error:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    vertShader = compile(gl.VERTEX_SHADER,   VERT_SRC);
    fragShader = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vertShader || !fragShader) return false;

    program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Julia program link error:", gl.getProgramInfoLog(program));
      return false;
    }
    gl.useProgram(program);

    // 全屏四边形（两个三角形，覆盖 NDC [-1,1]²）
    const verts = new Float32Array([-1,-1,  1,-1,  -1,1,  1,-1,  1,1,  -1,1]);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // 缓存所有 uniform 位置
    uLoc = {
      c:          gl.getUniformLocation(program, "u_c"),
      center:     gl.getUniformLocation(program, "u_center"),
      scale:      gl.getUniformLocation(program, "u_scale"),
      maxIter:    gl.getUniformLocation(program, "u_maxIter"),
      time:       gl.getUniformLocation(program, "u_time"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
    };
    return true;
  }

  // ── 单帧渲染 ──────────────────────────────────────────────────────────────
  // CPU 工作量：6 次 uniform 上传 + 1 次 drawArrays 调用，仅此而已。
  // 所有迭代计算在 GPU 上以每像素一个线程的方式并行完成。
  function renderFrame(canvas, view, cReal, cImag) {
    if (!gl) {
      if (!initGL(canvas)) return; // WebGL 不可用，静默失败
    }

    // Ensure viewport matches canvas dimensions (handles high-DPI)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const zoomLevel   = Math.max(1, -Math.log10(view.scale / 3.0));
    const maxIter     = Math.floor(120 + zoomLevel * 180); // 缩放越深迭代越多

    gl.uniform2f(uLoc.c,          cReal, cImag);
    gl.uniform2f(uLoc.center,     view.centerX, view.centerY);
    gl.uniform1f(uLoc.scale,      view.scale);
    gl.uniform1i(uLoc.maxIter,    maxIter);
    gl.uniform1f(uLoc.time,       time);
    gl.uniform2f(uLoc.resolution, canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // WebGL 默认双缓冲，drawArrays 后立即可见，无需 putImageData
  }

  // ── cleanup ───────────────────────────────────────────────────────────────
  function cleanup() {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
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
    return DEFAULT_VIEW;
  }

  // ── 动画循环 ──────────────────────────────────────────────────────────────
  // GPU 渲染速度极快（每帧 <1ms），帧率门控放宽到 60fps，画面更流畅。
  // 如需省电可改为 30fps（FRAME_INTERVAL = 1000/30）。
  const FRAME_INTERVAL = 1000 / 60;
  let lastFrameTime = 0;

  function tick(canvas, view, timestamp) {
    if (timestamp - lastFrameTime < FRAME_INTERVAL) {
      animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
      return;
    }
    lastFrameTime = timestamp;

    const preset = PRESETS[currentPresetIndex];
    time += FRAME_INTERVAL / 1000;

    let cReal = preset.real, cImag = preset.imag;
    const a = preset.driftAmount || 0.01;
    cReal += Math.sin(time * 0.3) * a;
    cImag += Math.cos(time * 0.5) * a;

    // GPU 渲染是同步的（在 rAF 回调里），直接调用，无需 Promise/Worker
    renderFrame(canvas, view, cReal, cImag);
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

  function draw(canvas, view, subsampling = 1) {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }

    lastFrameTime = 0;
    const preset = PRESETS[currentPresetIndex];
    let cReal = preset.real, cImag = preset.imag;
    const a = preset.driftAmount || 0.01;
    cReal += Math.sin(time * 0.3) * a;
    cImag += Math.cos(time * 0.5) * a;
    renderFrame(canvas, view, cReal, cImag);
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Julia: {
      id: "Julia",
      defaultView: DEFAULT_VIEW,
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw, cleanup, randomize, reset,
      formula: "zₙ₊₁ = zₙ² + c",
      explanationUrl: "/tools/math-wonder-box/julia-set.html",
    },
  };
})(window);
