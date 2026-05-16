export const THEME_STORAGE_KEY = "paralabs-theme";
export const THEME_CHANGE_EVENT = "paralabs-theme-change";

export type ThemePreference = "system" | "light" | "dark";

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function applyThemePreference(theme: ThemePreference) {
  const r = document.documentElement;
  r.classList.remove("light", "dark");
  if (theme === "light") r.classList.add("light");
  if (theme === "dark") r.classList.add("dark");
}

export function persistThemePreference(theme: ThemePreference) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeThemePreference(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_CHANGE_EVENT, cb);
  };
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}
