const STORAGE_KEY = "useChromeNewTab";
const THEME_KEY = "theme";
const DEFAULT_THEME = "light";

const statusEl = document.getElementById("modeStatus");
const restoreButton = document.getElementById("restoreMathNewTab");
const themeButton = document.getElementById("toggleTheme");

function getStorageValue(key, defaultValue = false) {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [key]: defaultValue }, (items) => resolve(items[key]));
  });
}

function setStorageValue(key, value) {
  return new Promise((resolve) => {
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

  // Update title
  document.title = chrome.i18n.getMessage("extension_name");
}

async function refreshStatus() {
  if (!statusEl) return;
  const usesChromeNewTab = await getStorageValue(STORAGE_KEY);
  statusEl.textContent = usesChromeNewTab
    ? chrome.i18n.getMessage("popup_status_chrome_active")
    : chrome.i18n.getMessage("popup_status_math_active");
}

async function applyTheme() {
  const theme = await getStorageValue(THEME_KEY, DEFAULT_THEME);
  if (theme === "dark") {
    document.documentElement.classList.add("theme-dark");
    if (themeButton) themeButton.textContent = chrome.i18n.getMessage("theme_toggle_to_light");
  } else {
    document.documentElement.classList.remove("theme-dark");
    if (themeButton) themeButton.textContent = chrome.i18n.getMessage("theme_toggle_to_dark");
  }
}

if (restoreButton) {
  restoreButton.addEventListener("click", async () => {
    restoreButton.disabled = true;
    await setStorageValue(STORAGE_KEY, false);
    await chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
    window.close();
  });
}

if (themeButton) {
  themeButton.addEventListener("click", async () => {
    const currentTheme = await getStorageValue(THEME_KEY, DEFAULT_THEME);
    const newTheme = currentTheme === "light" ? "dark" : "light";
    await setStorageValue(THEME_KEY, newTheme);
    applyTheme();
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes[THEME_KEY]) {
    applyTheme();
  }
  if (changes[STORAGE_KEY]) {
    refreshStatus();
  }
});

localize();
refreshStatus();
applyTheme();
