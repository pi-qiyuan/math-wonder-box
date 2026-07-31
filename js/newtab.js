const TOP_SITE_LIMIT = 12;
const STORAGE_KEY = "useChromeNewTab";
const THEME_KEY = "theme";
const DEFAULT_THEME = "light";
const CHROME_NATIVE_NEW_TAB_URL = "chrome://new-tab-page/";
const FRACTALS = [
  { id: "Aizawa",             labelKey: "aizawa_canvas_aria",          eyebrowKey: "aizawa_eyebrow",          titleKey: "aizawa_title",          invertY: false },
  { id: "ApollonianGasket",   labelKey: "apollonian_canvas_aria",      eyebrowKey: "apollonian_eyebrow",      titleKey: "apollonian_title",      invertY: true  },
  { id: "BarnsleyFern",       labelKey: "barnsley_canvas_aria",        eyebrowKey: "barnsley_eyebrow",        titleKey: "barnsley_title",        invertY: true  },
  { id: "Bifurcation",        labelKey: "bifurcation_canvas_aria",     eyebrowKey: "bifurcation_eyebrow",     titleKey: "bifurcation_title",     invertY: true  },
  { id: "ChladniFigure",      labelKey: "chladni_canvas_aria",         eyebrowKey: "chladni_eyebrow",         titleKey: "chladni_title",         invertY: false },
  { id: "Clifford",           labelKey: "clifford_canvas_aria",        eyebrowKey: "clifford_eyebrow",        titleKey: "clifford_title",        invertY: false },
  { id: "DoublePendulum",     labelKey: "double_pendulum_canvas_aria", eyebrowKey: "double_pendulum_eyebrow", titleKey: "double_pendulum_title", invertY: false },
  { id: "DragonCurve",        labelKey: "dragon_canvas_aria",          eyebrowKey: "dragon_eyebrow",          titleKey: "dragon_title",          invertY: false },
  { id: "Epicycloid",         labelKey: "epicycloid_canvas_aria",      eyebrowKey: "epicycloid_eyebrow",      titleKey: "epicycloid_title",      invertY: false },
  { id: "Fibonacci",          labelKey: "fibonacci_canvas_aria",       eyebrowKey: "fibonacci_eyebrow",       titleKey: "fibonacci_title",       invertY: false },
  { id: "FibonacciTree",      labelKey: "fibonacci_tree_canvas_aria",  eyebrowKey: "fibonacci_tree_eyebrow",  titleKey: "fibonacci_tree_title",  invertY: false },
  { id: "HilbertCurve",       labelKey: "hilbert_canvas_aria",         eyebrowKey: "hilbert_eyebrow",         titleKey: "hilbert_title",         invertY: false },
  { id: "Hopalong",           labelKey: "hopalong_canvas_aria",        eyebrowKey: "hopalong_eyebrow",        titleKey: "hopalong_title",        invertY: false },
  { id: "Julia",              labelKey: "julia_canvas_aria",           eyebrowKey: "julia_eyebrow",           titleKey: "julia_title",           invertY: true, renderer: "webgl" },
  { id: "KochSnowflake",      labelKey: "koch_canvas_aria",            eyebrowKey: "koch_eyebrow",            titleKey: "koch_title",            invertY: false },
  { id: "LangtonsAnt",        labelKey: "langtons_ant_canvas_aria",    eyebrowKey: "langtons_ant_eyebrow",    titleKey: "langtons_ant_title",    invertY: false },
  { id: "LevyCurve",          labelKey: "levy_canvas_aria",            eyebrowKey: "levy_eyebrow",            titleKey: "levy_title",            invertY: false },
  { id: "Lissajous",          labelKey: "lissajous_canvas_aria",       eyebrowKey: "lissajous_eyebrow",       titleKey: "lissajous_title",       invertY: false },
  { id: "Lorenz",             labelKey: "lorenz_canvas_aria",          eyebrowKey: "lorenz_eyebrow",          titleKey: "lorenz_title",          invertY: false },
  { id: "Mandelbrot",         labelKey: "mandelbrot_canvas_aria",      eyebrowKey: "mandelbrot_eyebrow",      titleKey: "mandelbrot_title",      invertY: false, hasRandomize: false },
  { id: "Newton",             labelKey: "newton_canvas_aria",          eyebrowKey: "newton_eyebrow",          titleKey: "newton_title",          invertY: true, renderer: "webgl", },
  { id: "NoiseFlow",          labelKey: "noise_canvas_aria",           eyebrowKey: "noise_eyebrow",           titleKey: "noise_title",           invertY: true  },
  { id: "PenroseTiling",      labelKey: "penrose_canvas_aria",         eyebrowKey: "penrose_eyebrow",         titleKey: "penrose_title",         invertY: false },
  { id: "Phyllotaxis",        labelKey: "phyllotaxis_canvas_aria",     eyebrowKey: "phyllotaxis_eyebrow",     titleKey: "phyllotaxis_title",     invertY: false },
  { id: "PythagorasTree",     labelKey: "pythagoras_canvas_aria",      eyebrowKey: "pythagoras_eyebrow",      titleKey: "pythagoras_title",      invertY: false },
  { id: "ReactionDiffusion",  labelKey: "rd_canvas_aria",              eyebrowKey: "rd_eyebrow",              titleKey: "rd_title",              invertY: false, renderer: "webgl" },
  { id: "Rose",               labelKey: "rose_canvas_aria",            eyebrowKey: "rose_eyebrow",            titleKey: "rose_title",            invertY: false },
  { id: "SierpinskiCarpet",   labelKey: "sierpinski_canvas_aria",      eyebrowKey: "sierpinski_eyebrow",      titleKey: "sierpinski_title",      invertY: false },
  { id: "SierpinskiTriangle", labelKey: "sierpinski_tri_canvas_aria",  eyebrowKey: "sierpinski_tri_eyebrow",  titleKey: "sierpinski_tri_title",  invertY: true  },
  { id: "Spirograph",         labelKey: "spirograph_canvas_aria",      eyebrowKey: "spirograph_eyebrow",      titleKey: "spirograph_title",      invertY: false },
  { id: "Voronoi",            labelKey: "voronoi_canvas_aria",         eyebrowKey: "voronoi_eyebrow",         titleKey: "voronoi_title",         invertY: true, renderer: "webgl" },
];

const canvas2d = document.getElementById("mandelbrotCanvas");
const canvasWebgl = document.getElementById("webglCanvas");
let activeCanvas = canvas2d;

const topSitesEl = document.getElementById("topSites");
const siteCountEl = document.getElementById("siteCount");
const searchBox = document.getElementById("searchBox");
const clockEl = document.getElementById("clock");
const useChromeButton = document.getElementById("useChromeNewTab");
const themeButton = document.getElementById("toggleTheme");
const chromeModeDialog = document.getElementById("chromeModeDialog");
const confirmChromeButton = document.getElementById("confirmChromeNewTab");

// Toolbar elements
const fractalEyebrowEl = document.getElementById("fractal-eyebrow");
const fractalTitleEl = document.getElementById("fractal-title");
const fractalFormulaEl = document.getElementById("fractalFormula");
const switchButton = document.getElementById("switchFractal");
const saveImageButton = document.getElementById("saveImage");
const viewExplanationButton = document.getElementById("viewExplanation");
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const resetButton = document.getElementById("resetView");
const nextButton = document.getElementById("nextParams");

let activeSet;
let currentSetName;
let view;
let resizeHandle = 0;
let isDragging = false;
let renderRequested = false;
let lastMousePos = { x: 0, y: 0 };

function getStorageValue(key, defaultValue = false) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve(defaultValue);
      return;
    }

    chrome.storage.local.get({ [key]: defaultValue }, (items) => resolve(items[key]));
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      resolve();
      return;
    }

    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function localize() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const message = chrome.i18n.getMessage(key);
    if (message) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.placeholder = message;
      } else {
        el.textContent = message;
      }
    }
  });

  document.title = chrome.i18n.getMessage("extension_name");
}

async function applyTheme() {
  const theme = await getStorageValue(THEME_KEY, DEFAULT_THEME);
  if (theme === "dark") {
    document.documentElement.classList.add("theme-dark");
    themeButton.textContent = chrome.i18n.getMessage("theme_toggle_to_light");
  } else {
    document.documentElement.classList.remove("theme-dark");
    themeButton.textContent = chrome.i18n.getMessage("theme_toggle_to_dark");
  }
  
  if (typeof drawActiveSet === "function" && activeSet) {
    clearActiveCanvas();
    drawActiveSet(1);
  }
}

function openChromeNativeNewTab() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.getCurrent || !chrome.tabs?.update) {
      resolve(false);
      return;
    }

    chrome.tabs.getCurrent((tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        resolve(false);
        return;
      }

      chrome.tabs.update(tab.id, { url: CHROME_NATIVE_NEW_TAB_URL }, () => {
        resolve(!chrome.runtime.lastError);
      });
    });
  });
}

async function switchToChromeNativeNewTab() {
  await setStorageValue(STORAGE_KEY, true);
  const opened = await openChromeNativeNewTab();

  if (!opened) {
    await setStorageValue(STORAGE_KEY, false);
    window.alert(chrome.i18n.getMessage("error_blocked_chrome_newtab"));
    confirmChromeButton.disabled = false;
  }
}

async function redirectIfChromeMode() {
  const usesChromeNewTab = await getStorageValue(STORAGE_KEY);
  if (usesChromeNewTab) {
    return openChromeNativeNewTab();
  }

  return false;
}

function updateClock() {
  clockEl.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function renderTopSites(sites) {
  const visibleSites = sites.slice(0, TOP_SITE_LIMIT);
  siteCountEl.textContent = visibleSites.length ? chrome.i18n.getMessage("newtab_site_count_shown", [visibleSites.length.toString()]) : "";
  topSitesEl.replaceChildren();

  if (!visibleSites.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = chrome.i18n.getMessage("newtab_empty_links");
    topSitesEl.append(empty);
    return;
  }

  for (const site of visibleSites) {
    const tile = document.createElement("a");
    tile.className = "site-tile";
    tile.href = site.url;

    const icon = document.createElement("div");
    icon.className = "site-icon";
    
    const iconImg = document.createElement("img");
    iconImg.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(site.url)}&size=32`;
    iconImg.alt = "";
    icon.append(iconImg);

    const meta = document.createElement("span");
    meta.className = "site-meta";

    const title = document.createElement("span");
    title.className = "site-title";
    title.textContent = site.title || normalizeUrl(site.url);

    meta.append(title);
    tile.append(icon, meta);
    topSitesEl.append(tile);
  }
}

function loadTopSites() {
  if (typeof chrome === "undefined" || !chrome.topSites?.get) {
    renderTopSites([]);
    return;
  }

  chrome.topSites.get((sites) => {
    renderTopSites(Array.isArray(sites) ? sites : []);
  });
}

function searchOrNavigate(value) {
  const query = value.trim();
  if (!query) return;

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(query);
  const looksLikeHost = /^[^\s]+\.[^\s]{2,}(\/.*)?$/i.test(query);
  const target = hasProtocol ? query : looksLikeHost ? `https://${query}` : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.location.href = target; searchBox.value = "";
}

function drawActiveSet(subsampling = 1) {
  if (activeSet) {
    activeSet.draw(activeCanvas, view, subsampling);
  }
}

function updateFractalFormula() {
  const formula = activeSet?.formula || "";
  fractalFormulaEl.textContent = formula;
  fractalFormulaEl.style.display = formula ? "block" : "none";
}

function scheduleDraw() {
  window.clearTimeout(resizeHandle);
  resizeHandle = window.setTimeout(() => drawActiveSet(1), 80);
}

function requestRender() {
  if (renderRequested) return;
  renderRequested = true;
  requestAnimationFrame(() => {
    drawActiveSet(isDragging ? 2 : 1);
    renderRequested = false;
  });
}

searchBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchOrNavigate(searchBox.value);
  }
});

function handleMouseDown(event) {
  if (event.button !== 0) return; // Only left click starts drag
  isDragging = true;
  lastMousePos = { x: event.clientX, y: event.clientY };
  activeCanvas.style.cursor = "grabbing";
}

canvas2d.addEventListener("mousedown", handleMouseDown);
canvasWebgl.addEventListener("mousedown", handleMouseDown);

window.addEventListener("mousemove", (event) => {
  if (!isDragging) return;

  const dx = event.clientX - lastMousePos.x;
  const dy = event.clientY - lastMousePos.y;
  lastMousePos = { x: event.clientX, y: event.clientY };

  const rect = activeCanvas.getBoundingClientRect();
  const aspect = activeCanvas.width / activeCanvas.height;
  
  view.centerX -= (dx / rect.width) * view.scale * aspect;

  const config = FRACTALS.find(f => f.id === currentSetName);
  if (config.invertY) {
    view.centerY += (dy / rect.height) * view.scale;
  } else {
    view.centerY -= (dy / rect.height) * view.scale;
  }
  
  requestRender();
});

window.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    activeCanvas.style.cursor = "grab";
    drawActiveSet(1);
  }
});

useChromeButton.addEventListener("click", () => {
  if (typeof chromeModeDialog.showModal === "function") {
    chromeModeDialog.showModal();
    return;
  }

  const confirmed = window.confirm(chrome.i18n.getMessage("dialog_switch_copy"));
  if (confirmed) {
    confirmChromeButton.click();
  }
});

themeButton.addEventListener("click", async () => {
  const currentTheme = await getStorageValue(THEME_KEY, DEFAULT_THEME);
  const newTheme = currentTheme === "light" ? "dark" : "light";
  await setStorageValue(THEME_KEY, newTheme);
  applyTheme();
});

confirmChromeButton.addEventListener("click", async () => {
  confirmChromeButton.disabled = true;
  await switchToChromeNativeNewTab();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[THEME_KEY]) {
    applyTheme();
  }
});

window.addEventListener("resize", scheduleDraw);

function handleWheel(event) {
  event.preventDefault();
  if (event.deltaY < 0) {
    view.scale *= 0.6;
  } else {
    view.scale *= 1.6;
  }
  drawActiveSet(1);
}

canvas2d.addEventListener("wheel", handleWheel, { passive: false });
canvasWebgl.addEventListener("wheel", handleWheel, { passive: false });

function bindFractalControls() {
  zoomInButton.addEventListener("click", () => {
    view.scale *= 0.6;
    drawActiveSet(1);
  });

  zoomOutButton.addEventListener("click", () => {
    view.scale *= 1.6;
    drawActiveSet(1);
  });

  resetButton.addEventListener("click", () => {
    if (activeSet.reset) {
      activeSet.reset();
    }
    view = { ...activeSet.defaultView };
    drawActiveSet(1);
  });

  nextButton.addEventListener("click", () => {
    if (activeSet.randomize) {
      const newView = activeSet.randomize(activeCanvas);
      if (newView) view = { ...newView };
      
      if (activeSet.currentNameKey) {
        fractalTitleEl.setAttribute("data-i18n", activeSet.currentNameKey);
        localize();
      }

      updateFractalFormula();
      
      drawActiveSet(1);
    }
  });

  switchButton.addEventListener("click", toggleFractal);

  saveImageButton.addEventListener("click", () => {
    const filename = fractalTitleEl.textContent.trim() + ".png";
    const link = document.createElement("a");
    link.download = filename;
    link.href = activeCanvas.toDataURL("image/png");
    link.click();
  });

  viewExplanationButton.addEventListener("click", () => {
    if (activeSet?.explanationUrl) {
      window.location.href = getExplanationTargetUrl(activeSet.explanationUrl);
    }
  });
}

function getExplanationTargetUrl(explanationUrl) {
  if (!explanationUrl) return "";
  let path = explanationUrl;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return path;
    }
  }
  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  const rawLang = (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
    ? chrome.i18n.getUILanguage()
    : navigator.language || "en").toLowerCase();

  if (rawLang.startsWith("en")) {
    return "https://hugbear.ai" + path;
  }

  let langPrefix = null;
  if (rawLang.startsWith("zh")) {
    langPrefix = "zh";
  } else if (rawLang.startsWith("pt")) {
    langPrefix = "pt-br";
  } else if (rawLang.startsWith("de")) {
    langPrefix = "de";
  } else if (rawLang.startsWith("es")) {
    langPrefix = "es";
  } else if (rawLang.startsWith("fr")) {
    langPrefix = "fr";
  } else if (rawLang.startsWith("ja")) {
    langPrefix = "ja";
  } else if (rawLang.startsWith("ko")) {
    langPrefix = "ko";
  }

  if (langPrefix) {
    return "https://hugbear.ai/" + langPrefix + path;
  }

  return "https://hugbear.ai" + path;
}

/**
 * Clears the active canvas with the theme-appropriate solid color
 * to prevent afterimages when switching fractals.
 */
function clearActiveCanvas() {
  const isDark = document.documentElement.classList.contains("theme-dark");
  const color = isDark ? "#050607" : "#f8fafc";
  
  // Get desired dimensions
  const rect = activeCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.floor((rect.width || activeCanvas.clientWidth || 900) * ratio);
  const height = Math.floor((rect.height || activeCanvas.clientHeight || 900) * ratio);

  // Only resize if necessary and dimensions are valid
  if (width > 0 && height > 0) {
    if (activeCanvas.width !== width || activeCanvas.height !== height) {
      activeCanvas.width = width;
      activeCanvas.height = height;
    }
  }

  // Differentiate clearing by canvas type to avoid context locking
  if (activeCanvas === canvasWebgl) {
    // This can be the first WebGL context request for the shared canvas. Context
    // attributes are fixed at creation, so it must preserve its drawing buffer
    // for the Save action's toDataURL() call to capture the rendered frame.
    const contextOptions = { antialias: false, alpha: false, preserveDrawingBuffer: true };
    const gl = activeCanvas.getContext("webgl", contextOptions)
      || activeCanvas.getContext("experimental-webgl", contextOptions);
    if (gl) {
      const r = isDark ? 0.0196 : 0.9725;
      const g = isDark ? 0.0235 : 0.9804;
      const b = isDark ? 0.0275 : 0.9882;
      gl.clearColor(r, g, b, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(0, 0, activeCanvas.width, activeCanvas.height);
    }
  } else {
    const ctx = activeCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, activeCanvas.width, activeCanvas.height);
    }
  }
}

async function loadFractal(setName) {
  if (activeSet && activeSet.cleanup) {
    activeSet.cleanup();
  }

  currentSetName = setName;
  activeSet = MathWonderSets[currentSetName] || MathWonderSets.Clifford;
  view = { ...activeSet.defaultView };

  const config = FRACTALS.find(f => f.id === currentSetName);
  const renderer = config.renderer || "2d";
  
  // Toggle canvases
  if (renderer === "webgl") {
    activeCanvas = canvasWebgl;
    canvas2d.style.display = "none";
    canvasWebgl.style.display = "block";
  } else {
    activeCanvas = canvas2d;
    canvasWebgl.style.display = "none";
    canvas2d.style.display = "block";
  }

  // Clear background before starting the new draw
  clearActiveCanvas();

  // Update toolbar text and visibility
  fractalEyebrowEl.setAttribute("data-i18n", config.eyebrowKey);
  
  const titleKey = activeSet.currentNameKey || config.titleKey;
  fractalTitleEl.setAttribute("data-i18n", titleKey);
  
  // Update formula
  updateFractalFormula();
  
  resetButton.style.display = "inline-flex";
  const canRandomize = config.hasRandomize !== false;
  nextButton.style.display = canRandomize ? "inline-flex" : "none";
  viewExplanationButton.style.display = activeSet?.explanationUrl ? "inline-flex" : "none";
  
  localize();
  drawActiveSet(1);
}

const fractalRandomizer = new TaboowRandomizer(FRACTALS.length, 3);

async function toggleFractal() {
  const randomIndex = fractalRandomizer.next();
  const newConfig = FRACTALS[randomIndex];

  loadFractal(newConfig.id);
}

async function init() {
  const redirected = await redirectIfChromeMode();
  if (redirected) return;

  const randomSetName = FRACTALS[fractalRandomizer.next()].id;
  
  loadTopSites();
  updateClock();
  window.setInterval(updateClock, 15 * 1000);
  applyTheme();
  bindFractalControls();

  await loadFractal(randomSetName);
}

init();
