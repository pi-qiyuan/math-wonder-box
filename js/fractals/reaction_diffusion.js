(function registerReactionDiffusion(global) {
  const DEFAULT_VIEW = { centerX: 0, centerY: 0, scale: 1.0 };
  
  const PRESETS = [
    // defaultScale is a per-preset baseline for the render uniform u_scale.
    // It's multiplied together with the caller-controlled view.scale (the
    // one external code adjusts via view.scale *= 1.6 / 0.6 etc.), so it
    // sets how zoomed-in/out this particular pattern starts out, while
    // still letting external zoom controls stack multiplicatively on top
    // as before. 1.0 = same framing as before this field existed; >1.0
    // zooms out (shows more of the pattern), <1.0 zooms in.
    { id: "coral",    nameKey: "rd_preset_coral",    f: 0.0545, k: 0.0620, noiseAmp: 0.0015, seedRadius: 0.04, growthDurationMs: 34000, defaultScale: 2 },
    { id: "worms",    nameKey: "rd_preset_worms",    f: 0.0580, k: 0.0630, noiseAmp: 0.0015, seedRadius: 0.04, growthDurationMs: 72000, defaultScale: 2 },
    { id: "spots",    nameKey: "rd_preset_spots",    f: 0.0300, k: 0.0530, noiseAmp: 0.0003, seedRadius: 0.09, growthDurationMs: 8000,  defaultScale: 2 },
    { id: "unstable", nameKey: "rd_preset_unstable", f: 0.0250, k: 0.0500, noiseAmp: 0.0015, seedRadius: 0.04, growthDurationMs: 18000, defaultScale: 2 }
    // "mitosis" (F=0.0367, K=0.0649) is intentionally excluded from
    // rotation: with this simulation's discretization, the seed
    // consistently decays back to the uniform background within a
    // fraction of a second regardless of seed size, seed concentration,
    // continuous noise on/off, or integration step size -- all confirmed
    // via debug instrumentation to be genuine decay, not a rendering
    // artifact. The parameter point appears to have no nonzero
    // homogeneous equilibrium to fall back on, and whatever spatial
    // profile is needed to sustain it as a diffusion-mediated pulse
    // wasn't found. Left here, disabled, in case it's worth revisiting
    // with a different seeding strategy later.
    // { 
    //   id: "mitosis", 
    //   nameKey: "rd_preset_mitosis", 
    //   f: 0.0367, k: 0.0649, 
    //   formula: "F=0.0367, K=0.0649 (Mitosis)",
    //   noiseAmp: 0.0, seedRadius: 0.04, growthDurationMs: 18000, defaultScale: 1.0
    // },
  ];

  const presetRandomizer = new TaboowRandomizer(PRESETS.length, 3);
  let currentPresetIndex = presetRandomizer.next();
  
  let gl = null;
  let programUpdate = null;
  let programRender = null;
  let textureA = null;
  let textureB = null;
  let frameBuffer = null;
  let vertexBuffer = null;
  let animationId = null;
  // Lowered from 48: this was the single biggest GPU cost (48 full-res
  // simulation passes every frame). 24 still looks fluid but roughly
  // halves the per-frame GPU work, which matters a lot on low-end GPUs.
  let iterationsPerFrame = 24;
  let needsReset = true;
  let time = 0;
  let useFloatTextures = false;
  let useLinearFilter = false;
  // The simulation no longer runs at the canvas's full physical pixel
  // resolution. Above this size, both the cost of each Laplacian sample
  // and the texture bandwidth grow with width*height, so on a 4K/high-DPR
  // display the unrestricted version could be simulating several million
  // texels per pass. Capping it keeps per-frame GPU work roughly constant
  // across devices/screens.
  const MAX_SIM_DIM = 512;
  let simWidth = 0;
  let simHeight = 0;
  let isPageVisible = true;
  // Timer-based auto-reset: this discretization tends to develop the
  // axis-aligned square/line artifact once a pattern has grown large
  // enough (a known grid-anisotropy limitation, not something we found a
  // full fix for). Rather than trying to visually detect the artifact
  // (which would need reading pixels back from the GPU and analyzing
  // them), just clear and reseed on a timer tuned to land before the
  // artifact typically becomes prominent.
  const DEFAULT_GROWTH_DURATION_MS = 18000;
  const PAUSE_DURATION_MS = 3000;
  let growthStartTime = null;
  let pauseEndTime = null;
  let debugRawB = false;
  let currentView = DEFAULT_VIEW;

  const VERT_SRC = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const UPDATE_FRAG_SRC = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_f;
    uniform float u_k;
    uniform float u_dt;
    uniform bool u_reset;
    uniform float u_seed;
    uniform float u_noiseAmp;
    uniform float u_seedRadius;
    varying vec2 v_uv;

    // NOTE: the classic fract(sin(dot(...)) * 43758.5453) hash is known
    // to produce visibly non-random, axis-aligned banding on many GPUs
    // (sin() loses precision for larger inputs on several mobile/desktop
    // drivers). That banding looks exactly like horizontal/vertical
    // stripes, which is disastrous for a noise source meant to break grid
    // symmetry. Use a multiplication/fract-based hash instead, which
    // doesn't rely on transcendental functions and stays well-behaved.
    float random(vec2 st) {
      vec3 p3 = fract(vec3(st.x, st.y, st.x) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    // Sample with the UV wrapped around [0,1), so the simulation domain
    // behaves as a torus (no edges) instead of relying on CLAMP_TO_EDGE,
    // which acts like a mirror and produces artificial straight-line wave
    // fronts parallel to the canvas edges.
    vec4 sampleWrapped(sampler2D tex, vec2 uv) {
      return texture2D(tex, fract(uv));
    }

    void main() {
      if (u_reset) {
        float dist = distance(v_uv, vec2(0.5));
        if (dist < u_seedRadius) {
          gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
        } else {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
        return;
      }

      vec2 texel = 1.0 / u_resolution;
      vec4 center = texture2D(u_texture, v_uv);
      
      // Laplacian (3x3 kernel), sampled with wrap-around so the boundary
      // doesn't act like a mirror and generate artificial straight stripes.
      // Weights use the more isotropic 1/6 (cardinal) / 1/12 (diagonal)
      // discretization (ratio 2:1) rather than 0.2/0.05 (ratio 4:1). The
      // steeper 4:1 ratio makes the front propagate noticeably faster
      // along the grid axes than along the diagonals, which is a
      // systematic bias -- not something random noise can cancel out --
      // and is what was pulling the growing front into a square envelope
      // with straight horizontal/vertical edges.
      vec4 lap = -center;
      lap += sampleWrapped(u_texture, v_uv + vec2(texel.x, 0.0)) * (1.0/6.0);
      lap += sampleWrapped(u_texture, v_uv - vec2(texel.x, 0.0)) * (1.0/6.0);
      lap += sampleWrapped(u_texture, v_uv + vec2(0.0, texel.y)) * (1.0/6.0);
      lap += sampleWrapped(u_texture, v_uv - vec2(0.0, texel.y)) * (1.0/6.0);
      lap += sampleWrapped(u_texture, v_uv + vec2(texel.x, texel.y)) * (1.0/12.0);
      lap += sampleWrapped(u_texture, v_uv - vec2(texel.x, texel.y)) * (1.0/12.0);
      lap += sampleWrapped(u_texture, v_uv + vec2(texel.x, -texel.y)) * (1.0/12.0);
      lap += sampleWrapped(u_texture, v_uv - vec2(texel.x, -texel.y)) * (1.0/12.0);

      float a = center.r;
      float b = center.g;
      float abb = a * b * b;
      
      float da = 1.0 * lap.r - abb + u_f * (1.0 - a);
      float db = 0.5 * lap.g + abb - (u_k + u_f) * b;

      // The discrete 9-point Laplacian above is only approximately
      // isotropic. At large scale, a growing front tends to lock onto the
      // grid's horizontal/vertical axes, where the stencil is most
      // accurate, and settles into a flat, stable, non-branching wave
      // (no curvature -> no branching instability), which is what produces
      // the straight lines / square boundary instead of continued organic
      // branching. A tiny amount of *continuous* per-step noise (not just
      // at reset) keeps perturbing the front so it never fully flattens
      // out and keeps branching regardless of scale or orientation.
      float n = random(v_uv * u_resolution + u_seed) - 0.5;
      db += n * u_noiseAmp;
      
      gl_FragColor = vec4(clamp(a + da * u_dt, 0.0, 1.0), clamp(b + db * u_dt, 0.0, 1.0), 0.0, 1.0);
    }
  `;

  const RENDER_FRAG_SRC = `
    precision highp float;
    uniform sampler2D u_texture;
    uniform bool u_isDark;
    uniform vec2 u_center;
    uniform float u_scale;
    uniform float u_aspect;
    uniform bool u_debugRaw;
    varying vec2 v_uv;

    void main() {
      vec2 uv = (v_uv - 0.5) * u_scale + 0.5;
      uv.x += u_center.x / u_aspect;
      uv.y -= u_center.y;

      float raw = texture2D(u_texture, uv).g;

      if (u_debugRaw) {
        // Debug visualization: show the raw b concentration directly as
        // grayscale, with NO threshold and NO scaling, so we can tell
        // whether the value is genuinely decaying to zero or whether it's
        // just being hidden by the display mapping below.
        gl_FragColor = vec4(raw, raw, raw, 1.0);
        return;
      }

      float val = raw;
      // Linearly scaling by 4 makes even near-zero residual diffusion
      // (which any grid-based diffusion has a faint, grid-anisotropic
      // "tail" of, far outside the actual reaction front) visible as solid
      // color. That faint tail is what was showing up as straight
      // horizontal/vertical lines and a squared-off boundary. Use a
      // smoothstep threshold instead so only concentrations that actually
      // correspond to real pattern (not numerical noise floor) get drawn.
      val = smoothstep(0.015, 0.35, val);
      
      vec3 colorA = u_isDark ? vec3(0.05, 0.06, 0.08) : vec3(0.97, 0.98, 0.99);
      vec3 colorB = u_isDark ? vec3(0.0, 0.8, 0.9) : vec3(0.0, 0.4, 0.6);
      
      gl_FragColor = vec4(mix(colorA, colorB, val), 1.0);
    }
  `;

  function createProgram(vSrc, fSrc) {
    const vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vSrc);
    gl.compileShader(vShader);
    if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
      console.error("ReactionDiffusion: vertex shader compile failed:\n" + gl.getShaderInfoLog(vShader));
    }

    const fShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fShader, fSrc);
    gl.compileShader(fShader);
    if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
      console.error("ReactionDiffusion: fragment shader compile failed:\n" + gl.getShaderInfoLog(fShader));
    }
    
    const prog = gl.createProgram();
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("ReactionDiffusion: program link failed:\n" + gl.getProgramInfoLog(prog));
    }

    // Shader objects are only needed during linking; once the program is
    // linked they can (and should) be freed to avoid leaking GL resources.
    gl.detachShader(prog, vShader);
    gl.detachShader(prog, fShader);
    gl.deleteShader(vShader);
    gl.deleteShader(fShader);

    return prog;
  }

  function createTexture(width, height, allowLinear) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const type = useFloatTextures ? gl.FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, null);
    // NEAREST is enough for the update-pass sampling (every offset is a
    // whole texel). But now that the simulation can run at a lower
    // resolution than the canvas (see MAX_SIM_DIM), the *render* pass
    // upscales this same texture across many more screen pixels, so we
    // optionally turn LINEAR on (when supported) purely to avoid a
    // blocky/pixelated look at the smaller simulation resolution. This is
    // safe to request for UNSIGNED_BYTE textures always; for FLOAT
    // textures it requires the OES_texture_float_linear extension, so the
    // caller only passes allowLinear=true once that's been confirmed.
    const filter = allowLinear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function framebufferSupportsFloatColor() {
    const testTex = createTexture(4, 4);
    const testFb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, testFb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, testTex, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(testFb);
    gl.deleteTexture(testTex);
    return complete;
  }

  function initGL(canvas) {
    gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) return false;

    // The reaction-diffusion update accumulates very small per-step deltas
    // (especially during the early instability phase that produces
    // branching/coral patterns). An 8-bit UNSIGNED_BYTE texture rounds
    // those tiny deltas away, so the simulation visibly "freezes" right
    // after the initial transient. Use a floating-point texture for the
    // simulation buffers whenever the browser/GPU actually supports
    // rendering into one; otherwise fall back to 8-bit (animation will
    // still run, just with the freezing artifact).
    const floatExt = gl.getExtension("OES_texture_float");
    if (floatExt) {
      useFloatTextures = true; // tentatively, so the probe below actually builds a FLOAT texture
      useFloatTextures = framebufferSupportsFloatColor();
    } else {
      useFloatTextures = false;
    }
    if (!useFloatTextures) {
      console.warn(
        "ReactionDiffusion: floating-point render targets are not supported " +
        "on this device; falling back to 8-bit textures. Patterns may " +
        "appear to freeze early due to precision loss."
      );
    }

    // Run the simulation at a capped resolution rather than the canvas's
    // full physical pixel size. The Laplacian sampling cost (8 texture
    // reads per texel per iteration, times iterationsPerFrame) scales with
    // width*height, so on a high-DPR or large canvas this is the single
    // biggest lever for GPU load. The render pass still draws to the full
    // canvas size; it just samples this smaller texture and (optionally)
    // benefits from linear filtering to avoid a blocky look.
    const simScale = Math.min(1, MAX_SIM_DIM / Math.max(canvas.width, canvas.height));
    simWidth = Math.max(64, Math.round(canvas.width * simScale));
    simHeight = Math.max(64, Math.round(canvas.height * simScale));

    // LINEAR filtering on the simulation texture is only safe without
    // restriction for UNSIGNED_BYTE textures. For FLOAT textures it
    // requires OES_texture_float_linear; fall back to NEAREST (slightly
    // blockier at low sim resolution, but still correct) if that
    // extension isn't available.
    useLinearFilter = !useFloatTextures || !!gl.getExtension("OES_texture_float_linear");

    programUpdate = createProgram(VERT_SRC, UPDATE_FRAG_SRC);
    programRender = createProgram(VERT_SRC, RENDER_FRAG_SRC);

    textureA = createTexture(simWidth, simHeight, useLinearFilter);
    textureB = createTexture(simWidth, simHeight, useLinearFilter);
    frameBuffer = gl.createFramebuffer();

    // Tiny offscreen target used to periodically estimate what fraction of
    // the canvas is "filled" with active pattern, by reading back a small
    // grayscale snapshot instead of the full-resolution texture (cheap).
    fillCheckSize = 12;
    fillCheckTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fillCheckTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fillCheckSize, fillCheckSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fillCheckFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fillCheckFrameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fillCheckTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,-1, 1,1, -1,1]);
    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    return true;
  }

  let visibilityListenerAdded = false;

  function handleVisibilityChange(canvas) {
    isPageVisible = !document.hidden;
    if (!isPageVisible) {
      // Page/tab is hidden: stop scheduling new frames so the GPU isn't
      // doing 24 full simulation passes per frame for an animation nobody
      // can see (a background tab, a minimized window, etc.).
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    } else if (gl && !animationId) {
      // Coming back into view: resume the loop. growthStartTime is left
      // as-is rather than reset, so a long time hidden will just be
      // counted toward the current pattern's growth duration (it'll
      // simply reseed sooner on return, which is harmless).
      animationId = requestAnimationFrame(ts => tick(canvas, ts));
    }
  }

  function ensureVisibilityListener(canvas) {
    if (visibilityListenerAdded) return;
    visibilityListenerAdded = true;
    document.addEventListener("visibilitychange", () => handleVisibilityChange(canvas));
  }

  function swapTextures() {
    const temp = textureA;
    textureA = textureB;
    textureB = temp;
  }

  function updateSimulation(canvas) {
    gl.useProgram(programUpdate);
    const preset = PRESETS[currentPresetIndex];
    
    const uRes = gl.getUniformLocation(programUpdate, "u_resolution");
    const uF = gl.getUniformLocation(programUpdate, "u_f");
    const uK = gl.getUniformLocation(programUpdate, "u_k");
    const uDt = gl.getUniformLocation(programUpdate, "u_dt");
    const uReset = gl.getUniformLocation(programUpdate, "u_reset");
    const uSeed = gl.getUniformLocation(programUpdate, "u_seed");
    const uNoiseAmp = gl.getUniformLocation(programUpdate, "u_noiseAmp");
    const uSeedRadius = gl.getUniformLocation(programUpdate, "u_seedRadius");
    const aPos = gl.getAttribLocation(programUpdate, "a_pos");

    gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(uRes, simWidth, simHeight);
    gl.uniform1f(uF, preset.f);
    gl.uniform1f(uK, preset.k);
    gl.uniform1f(uDt, 0.25);
    gl.uniform1f(uNoiseAmp, preset.noiseAmp);
    gl.uniform1f(uSeedRadius, preset.seedRadius);

    // The simulation framebuffer's texture is now smaller than the canvas
    // (see MAX_SIM_DIM), so the viewport must match it explicitly. Without
    // this, WebGL keeps whatever viewport render() last set (full canvas
    // size), which would only fill/clip a corner of the smaller texture
    // instead of mapping correctly across all of it.
    gl.viewport(0, 0, simWidth, simHeight);

    for (let i = 0; i < iterationsPerFrame; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textureB, 0);
      gl.bindTexture(gl.TEXTURE_2D, textureA);
      
      gl.uniform1i(uReset, needsReset ? 1 : 0);
      gl.uniform1f(uSeed, time * 1000.0 + i * 97.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      needsReset = false;
      swapTextures();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    time += 1;
  }

  function render(canvas, view) {
    gl.useProgram(programRender);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.classList.contains("theme-dark");
    const aspect = canvas.width / canvas.height;
    
    const uDark = gl.getUniformLocation(programRender, "u_isDark");
    const uCenter = gl.getUniformLocation(programRender, "u_center");
    const uScale = gl.getUniformLocation(programRender, "u_scale");
    const uAspect = gl.getUniformLocation(programRender, "u_aspect");
    const uDebugRaw = gl.getUniformLocation(programRender, "u_debugRaw");
    const aPos = gl.getAttribLocation(programRender, "a_pos");

    gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(uDark, isDark ? 1 : 0);
    gl.uniform2f(uCenter, view.centerX, view.centerY);
    // Combine the caller-controlled zoom (view.scale, which external code
    // adjusts via view.scale *= 1.6 / 0.6 etc.) with this preset's own
    // baseline framing (defaultScale). Multiplying them means external
    // zoom keeps working exactly as before -- it's just stacked on top of
    // a per-pattern starting size instead of always starting from 1.0.
    const presetDefaultScale = PRESETS[currentPresetIndex].defaultScale ?? 1.0;
    gl.uniform1f(uScale, view.scale * presetDefaultScale);
    gl.uniform1f(uAspect, aspect);
    gl.uniform1i(uDebugRaw, debugRawB ? 1 : 0);

    gl.bindTexture(gl.TEXTURE_2D, textureA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(canvas, timestamp) {
    if (!gl) return;

    if (pauseEndTime !== null) {
      if (timestamp >= pauseEndTime) {
        // Pause window is over: trigger a real reseed (which clears and
        // redraws via the u_reset branch in the update shader) and fall
        // through to render that fresh frame immediately.
        console.log("ReactionDiffusion: pause ended, reseeding");
        pauseEndTime = null;
        needsReset = true;
        growthStartTime = timestamp;
        updateSimulation(canvas);
        render(canvas, currentView);
      } else {
        // Still within the pause window: hold the last rendered frame as
        // it is. Skip the simulation update entirely (so the texture
        // doesn't change) and just redraw the same frame, so the final
        // pattern stays visible for the full pause duration before being
        // cleared.
        render(canvas, currentView);
        animationId = requestAnimationFrame(ts => tick(canvas, ts));
        return;
      }
    } else {
      if (growthStartTime === null) {
        growthStartTime = timestamp;
      }

      updateSimulation(canvas);
      render(canvas, currentView);

      const growthDurationMs = PRESETS[currentPresetIndex].growthDurationMs ?? DEFAULT_GROWTH_DURATION_MS;
      if (timestamp - growthStartTime > growthDurationMs) {
        console.log("ReactionDiffusion: growth duration elapsed (" + Math.round(timestamp - growthStartTime) + "ms), holding final frame for " + PAUSE_DURATION_MS + "ms");
        pauseEndTime = timestamp + PAUSE_DURATION_MS;
      }
    }

    animationId = requestAnimationFrame(ts => tick(canvas, ts));
  }

  function draw(canvas, view, subsampling = 1) {
    currentView = view;
    if (!gl) {
      if (!initGL(canvas)) return;
      needsReset = true;
    }
    ensureVisibilityListener(canvas);
    isPageVisible = !document.hidden;
    render(canvas, currentView);
    if (!animationId && isPageVisible) {
      animationId = requestAnimationFrame(ts => tick(canvas, ts));
    }
  }

  function cleanup() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    if (gl) {
      if (programUpdate) gl.deleteProgram(programUpdate);
      if (programRender) gl.deleteProgram(programRender);
      if (textureA) gl.deleteTexture(textureA);
      if (textureB) gl.deleteTexture(textureB);
      if (frameBuffer) gl.deleteFramebuffer(frameBuffer);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
    }
    gl = null;

    // Clear out references to now-deleted GL objects and reset simulation
    // state so a subsequent draw() starts from a clean slate instead of
    // inheriting stale state from this run.
    programUpdate = null;
    programRender = null;
    textureA = null;
    textureB = null;
    frameBuffer = null;
    vertexBuffer = null;
    needsReset = true;
    time = 0;
    growthStartTime = null;
    pauseEndTime = null;
  }

  function reset() {
    needsReset = true;
    time = 0;
    growthStartTime = null;
    pauseEndTime = null;
  }

  function randomize() {
    currentPresetIndex = presetRandomizer.next();
    needsReset = true;
    growthStartTime = null;
    pauseEndTime = null;
    return DEFAULT_VIEW;
  }

  function setDebugRaw(enabled) {
    debugRawB = !!enabled;
  }

  global.MathWonderSets = {
    ...(global.MathWonderSets || {}),
    ReactionDiffusion: {
      id: "ReactionDiffusion",
      defaultView: DEFAULT_VIEW,
      get currentNameKey() { return PRESETS[currentPresetIndex].nameKey; },
      draw, cleanup, randomize, reset, setDebugRaw,
      get formula() { return PRESETS[currentPresetIndex].formula; },
      // explanationUrl: "explanations/reaction_diffusion.html",
    },
  };
})(window);