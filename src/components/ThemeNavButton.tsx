"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  applyThemePreference,
  cycleThemePreference,
  persistThemePreference,
  readThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/themePreference";

function IconSystem() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLight() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v1.5M12 20.5V22M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M2 12h1.5M20.5 12H22M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06" />
    </svg>
  );
}

function IconDark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const TITLES: Record<ThemePreference, string> = {
  system: "Theme: system (click for light)",
  light: "Theme: light (click for dark)",
  dark: "Theme: dark (click for system)",
};

export default function ThemeNavButton() {
  const theme = useSyncExternalStore<ThemePreference>(
    subscribeThemePreference,
    readThemePreference,
    () => "system",
  );

  const onClick = useCallback(() => {
    const next = cycleThemePreference(theme);
    applyThemePreference(next);
    persistThemePreference(next);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={TITLES[theme]}
      aria-label={TITLES[theme]}
      className="-m-1.5 shrink-0 rounded p-1.5 text-nothing-secondary transition-colors duration-200 ease-nothing hover:text-nothing-primary"
    >
      {theme === "system" ? <IconSystem /> : theme === "light" ? <IconLight /> : <IconDark />}
    </button>
  );
}
