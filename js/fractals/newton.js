(function registerNewtonFractal(global) {
  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 4.0 };

  const PRESETS = [
    { id: "classic",        type: "poly", power: 3, alpha: [1.0, 0.0], isNova: false, isInverted: false, nameKey: "newton_preset_classic",        formula: "zₙ₊₁ = zₙ - (zₙ³ - 1) / 3zₙ²"          },
    { id: "cubic",          type: "poly", power: 4, alpha: [1.0, 0.0], isNova: false, isInverted: false, nameKey: "newton_preset_cubic",          formula: "zₙ₊₁ = zₙ - (zₙ⁴ - 1) / 4zₙ³"          },
    { id: "relaxed",        type: "poly", power: 3, alpha: [0.8, 0.0], isNova: false, isInverted: false, nameKey: "newton_preset_relaxed",        formula: "zₙ₊₁ = zₙ - 0.8 * f(zₙ)/f'(zₙ)"        },
    { id: "twisted",        type: "poly", power: 3, alpha: [0.9, 0.3], isNova: false, isInverted: false, nameKey: "newton_preset_twisted",        formula: "zₙ₊₁ = zₙ - (0.9+0.3i) * f(zₙ)/f'(zₙ)" },
    { id: "nova",           type: "poly", power: 3, alpha: [1.0, 0.0], isNova: true,  isInverted: false, nameKey: "newton_preset_nova",           formula: "zₙ₊₁ = zₙ - f(zₙ)/f'(zₙ) + c"          },
    { id: "generalized",    type: "poly", power: 5, alpha: [1.0, 0.0], isNova: false, isInverted: false, nameKey: "newton_preset_generalized",    formula: "zₙ₊₁ = zₙ - (z⁵ + Az³ + B) / f'(z)"   },
    { id: "transcendental", type: "sin",  power: 0, alpha: [1.0, 0.0], isNova: false, isInverted: false, nameKey: "newton_preset_transcendental", formula: "zₙ₊₁ = zₙ - sin(z) / cos(z)"          },
    { id: "inverted",       type: "poly", power: 3, alpha: [1.0, 0.0], isNova: false, isInverted: true,  nameKey: "newton_preset_inverted",       formula: "Newton set mapped to 1/z"            }
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();

  let gl = null;
  let program = null;
  let vertShader = null;
  let fragShader = null;
  let vertexBuffer = null;
  let uLoc = {};
  let animationId = null;
  let time = 0;
  let lastFrameTime = 0;

  const VERT_SRC = `
    attribute vec2 a_pos;
    varying   vec2 v_uv;
    void main() {
      v_uv        = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG_SRC = `
    precision highp float;

    uniform vec2  u_center;
    uniform float u_scale;
    uniform int   u_maxIter;
    uniform vec2  u_resolution;
    uniform int   u_power;
    uniform vec2  u_alpha;
    uniform float u_time;
    uniform bool  u_isNova;
    uniform int   u_type;
    uniform bool  u_isInverted;

    varying vec2 v_uv;

    vec2 complexMul(vec2 a, vec2 b) {
      return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
    }

    vec2 complexDiv(vec2 a, vec2 b) {
      float d = dot(b, b);
      if (d == 0.0) return vec2(0.0, 0.0);
      return vec2(dot(a, b), a.y*b.x - a.x*b.y) / d;
    }

    vec2 complexPower(vec2 z, int n) {
      vec2 res = vec2(1.0, 0.0);
      for (int i = 0; i < 8; i++) {
        if (i >= n) break;
        res = complexMul(res, z);
      }
      return res;
    }

    vec2 complexSin(vec2 z) {
      float e_y = exp(z.y);
      float e_ny = exp(-z.y);
      float cosh_y = (e_y + e_ny) * 0.5;
      float sinh_y = (e_y - e_ny) * 0.5;
      return vec2(sin(z.x) * cosh_y, cos(z.x) * sinh_y);
    }

    vec2 complexCos(vec2 z) {
      float e_y = exp(z.y);
      float e_ny = exp(-z.y);
      float cosh_y = (e_y + e_ny) * 0.5;
      float sinh_y = (e_y - e_ny) * 0.5;
      return vec2(cos(z.x) * cosh_y, -sin(z.x) * sinh_y);
    }

    vec3 hueShift(vec3 color, float shift) {
      vec3 k = vec3(0.57735, 0.57735, 0.57735);
      float cosAngle = cos(shift);
      return vec3(color * cosAngle + cross(k, color) * sin(shift) + k * dot(k, color) * (1.0 - cosAngle));
    }

    vec3 getRootColor(vec2 z, int power, int type) {
      float angle = atan(z.y, z.x);
      if (angle < 0.0) angle += 6.283185;
      float div = (type == 1) ? 3.14159 : (6.283185 / float(power));
      int idx = int(mod(angle / div + 0.5, 4.0));
      if (idx == 0) return vec3(1.0, 0.4, 0.4);
      if (idx == 1) return vec3(0.4, 1.0, 0.4);
      if (idx == 2) return vec3(0.4, 0.4, 1.0);
      if (idx == 3) return vec3(1.0, 0.9, 0.4);
      return vec3(1.0, 1.0, 1.0);
    }

    float getSmoothIter(vec2 p, int power, int maxIter, vec2 alpha, bool isNova, int type) {
      vec2 z = isNova ? vec2(1.0, 0.0) : p;
      float lastDist = 1000.0;
      float tol = 0.0001;
      for (int i = 0; i < 100; i++) {
        if (i >= maxIter) break;
        vec2 z_prev = z;
        vec2 fz, dfz;
        if (type == 1) {
          fz = complexSin(z) - vec2(1.0, 0.0);
          dfz = complexCos(z);
        } else if (power == 5) {
          vec2 z3 = complexPower(z, 3);
          vec2 z5 = complexMul(z3, complexMul(z, z));
          vec2 coeffA = vec2(sin(u_time * 0.2) * 0.5, cos(u_time * 0.3) * 0.5);
          fz = z5 + complexMul(coeffA, z3) - vec2(1.0, 0.0);
          dfz = 5.0 * complexPower(z, 4) + 3.0 * complexMul(coeffA, complexMul(z, z));
        } else {
          fz = complexPower(z, power) - vec2(1.0, 0.0);
          dfz = float(power) * complexPower(z, power - 1);
        }
        z = z - complexMul(alpha, complexDiv(fz, dfz));
        if (isNova) z += p;
        float dist = length(z - z_prev);
        if (dist < tol) {
          float frac = (log(tol) - log(dist)) / (log(lastDist) - log(dist));
          return float(i) + clamp(frac, 0.0, 1.0);
        }
        lastDist = dist;
      }
      return float(maxIter);
    }

    void main() {
      float aspect = u_resolution.x / u_resolution.y;
      vec2 uv = v_uv - 0.5;
      vec2 z0 = vec2(uv.x * u_scale * aspect, uv.y * u_scale) + u_center;
      
      if (u_isInverted) {
        float r2 = dot(z0, z0);
        z0 = (r2 < 0.0001) ? z0 : z0 / r2;
      }

      float osc = sin(u_time * 0.4) * 0.03;
      vec2 alpha = u_alpha + vec2(osc, cos(u_time * 0.25) * 0.015);

      vec2 z = u_isNova ? vec2(1.0, 0.0) : z0;
      int iter = 0;
      float smoothIter = 0.0;
      bool converged = false;
      float lastDist = 1000.0;
      float tol = 0.0001;
      float minTrapDist = 1e10;

      for (int i = 0; i < 100; i++) {
        if (i >= u_maxIter) break;
        vec2 z_prev = z;
        vec2 fz, dfz;
        if (u_type == 1) {
          fz = complexSin(z) - vec2(1.0, 0.0);
          dfz = complexCos(z);
        } else if (u_power == 5) {
          vec2 z3 = complexPower(z, 3);
          vec2 z5 = complexMul(z3, complexMul(z, z));
          vec2 coeffA = vec2(sin(u_time * 0.2) * 0.5, cos(u_time * 0.3) * 0.5);
          fz = z5 + complexMul(coeffA, z3) - vec2(1.0, 0.0);
          dfz = 5.0 * complexPower(z, 4) + 3.0 * complexMul(coeffA, complexMul(z, z));
        } else {
          fz = complexPower(z, u_power) - vec2(1.0, 0.0);
          dfz = float(u_power) * complexPower(z, u_power - 1);
        }
        
        z = z - complexMul(alpha, complexDiv(fz, dfz));
        if (u_isNova) z += z0;
        
        float trapDist = min(abs(z.x), abs(z.y));
        minTrapDist = min(minTrapDist, trapDist);

        float dist = length(z - z_prev);
        if (dist < tol) {
          converged = true;
          iter = i;
          float frac = (log(tol) - log(dist)) / (log(lastDist) - log(dist));
          smoothIter = float(i) + clamp(frac, 0.0, 1.0);
          break;
        }
        lastDist = dist;
      }

      if (!converged) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      float si = smoothIter;
      float eps = u_scale / u_resolution.y; 
      float siX = getSmoothIter(z0 + vec2(eps, 0.0), u_power, u_maxIter, alpha, u_isNova, u_type);
      float siY = getSmoothIter(z0 + vec2(0.0, eps), u_power, u_maxIter, alpha, u_isNova, u_type);
      
      float bump = 0.5;
      vec3 normal = normalize(vec3(bump * (siX - si), bump * (siY - si), eps));
      vec3 lightDir = normalize(vec3(sin(u_time * 0.2), cos(u_time * 0.2), 1.5));
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

      vec3 baseColor = getRootColor(z, u_power, u_type);
      baseColor = hueShift(baseColor, u_time * 0.06);
      
      float depth = 1.0 - si / float(u_maxIter);
      depth = pow(depth, 0.5);
      float trapEffect = 1.0 - clamp(minTrapDist * 2.0, 0.0, 1.0);
      trapEffect = pow(trapEffect, 4.0);

      vec3 finalColor = baseColor * (0.35 + 0.65 * diff) * depth;
      finalColor += vec3(0.85, 0.9, 1.0) * spec * 0.45;
      finalColor += vec3(0.5, 0.6, 0.9) * trapEffect * depth;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  function initGL(canvas) {
    const ctx = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true })
              || canvas.getContext("experimental-webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!ctx) return false;
    gl = ctx;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Newton shader error:", gl.getShaderInfoLog(s));
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
      console.error("Newton program link error:", gl.getProgramInfoLog(program));
      return false;
    }
    gl.useProgram(program);

    const verts = new Float32Array([-1,-1,  1,-1,  -1,1,  1,-1,  1,1,  -1,1]);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uLoc = {
      center:     gl.getUniformLocation(program, "u_center"),
      scale:      gl.getUniformLocation(program, "u_scale"),
      maxIter:    gl.getUniformLocation(program, "u_maxIter"),
      resolution: gl.getUniformLocation(program, "u_resolution"),
      power:      gl.getUniformLocation(program, "u_power"),
      alpha:      gl.getUniformLocation(program, "u_alpha"),
      time:       gl.getUniformLocation(program, "u_time"),
      isNova:     gl.getUniformLocation(program, "u_isNova"),
      type:       gl.getUniformLocation(program, "u_type"),
      isInverted: gl.getUniformLocation(program, "u_isInverted"),
    };
    return true;
  }

  function render(canvas, view) {
    if (!gl) {
      if (!initGL(canvas)) return;
    }

    // Ensure viewport matches canvas dimensions (handles high-DPI)
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const preset = PRESETS[currentPresetIndex];
    const maxIter = (preset.type === "sin") ? 30 : 40;

    gl.uniform2f(uLoc.center,     view.centerX, view.centerY);
    gl.uniform1f(uLoc.scale,      view.scale);
    gl.uniform1i(uLoc.maxIter,    maxIter);
    gl.uniform2f(uLoc.resolution, canvas.width, canvas.height);
    gl.uniform1i(uLoc.power,      preset.power);
    gl.uniform2f(uLoc.alpha,      preset.alpha[0], preset.alpha[1]);
    gl.uniform1f(uLoc.time,       time);
    gl.uniform1i(uLoc.isNova,     preset.isNova ? 1 : 0);
    gl.uniform1i(uLoc.type,       (preset.type === "sin") ? 1 : 0);
    gl.uniform1i(uLoc.isInverted, preset.isInverted ? 1 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(canvas, view, timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    time += deltaTime / 1000;

    render(canvas, view);
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

  function draw(canvas, view, subsampling = 1) {
    if (animationId) cancelAnimationFrame(animationId);
    lastFrameTime = 0;
    render(canvas, view);
    animationId = requestAnimationFrame(ts => tick(canvas, view, ts));
  }

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

  function reset() {
    time = 0;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    Newton: {
      id: "Newton",
      defaultView: DEFAULT_VIEW,
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw, cleanup, randomize, reset,
      get formula() { return PRESETS[currentPresetIndex].formula; },
      // explanationUrl: "explanations/newton.html",
    },
  };
})(window);
