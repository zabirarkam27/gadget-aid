const THEME_KEY = "theme";
const THEME_EVENT = "gadgetaid:theme-change";

const normalizeTheme = (value) =>
  value === "gadgetlight" ? "gadgetlight" : "gadgetdark";

export const initializeTheme = () => {
  let theme = "gadgetdark";
  try {
    theme = normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    // Appearance still works when browser storage is unavailable.
  }
  document.documentElement.dataset.theme = theme;
};

export const getTheme = () => normalizeTheme(document.documentElement.dataset.theme);

export const setTheme = (theme) => {
  const nextTheme = normalizeTheme(theme);
  document.documentElement.dataset.theme = nextTheme;
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // Keep the selection for this session without requiring storage access.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
};

export const subscribeTheme = (listener) => {
  const onStorage = (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      initializeTheme();
      listener();
    }
  };
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
};
