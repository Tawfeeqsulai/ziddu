"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, useState } from "react";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "ziddu-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useLayoutEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const currentTheme: Theme = savedTheme === "dark" || document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(currentTheme);
    document.documentElement.dataset.theme = currentTheme;
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      className="profile-action profile-theme-toggle"
      onClick={toggleTheme}
      type="button"
    >
      <span className="profile-theme-icon" aria-hidden="true">{isDark ? <Moon size={18} /> : <Sun size={18} />}</span>
      <span className="profile-theme-copy"><strong>Appearance</strong><small>{isDark ? "Dark mode" : "Light mode"}</small></span>
      <span className={`profile-theme-switch ${isDark ? "is-dark" : ""}`} aria-hidden="true"><span /></span>
    </button>
  );
}
