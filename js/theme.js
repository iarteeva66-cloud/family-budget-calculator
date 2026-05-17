(function (global) {
  var THEME_KEY = "theme";

  function getInitialTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return global.matchMedia && global.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme, buttonEl) {
    document.documentElement.setAttribute("data-theme", theme);
    if (buttonEl) {
      buttonEl.textContent = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
    }
  }

  function initTheme(buttonId, onChange) {
    var btn = buttonId ? document.getElementById(buttonId) : null;
    applyTheme(getInitialTheme(), btn);
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") || "light";
      var next = cur === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next, btn);
      if (typeof onChange === "function") onChange(next);
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    global.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  global.BudgetTheme = {
    THEME_KEY: THEME_KEY,
    getInitialTheme: getInitialTheme,
    applyTheme: applyTheme,
    initTheme: initTheme,
    registerServiceWorker: registerServiceWorker
  };
})(window);
