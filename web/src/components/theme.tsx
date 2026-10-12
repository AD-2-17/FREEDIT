"use client";

import { THEME_KEY as KEY } from "@/lib/theme-script";
import { Icon } from "./icon";

function isDark() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set) return set === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sun/moon switch. Flips between light and dark and remembers the choice on this device. */
export function ThemeToggle() {
  function flip() {
    const next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // private mode: the switch still works for this visit
    }
  }
  return (
    <button type="button" className="iconbtn" onClick={flip} aria-label="Switch between light and dark">
      <span className="ic-moon"><Icon name="moon" size="sm" /></span>
      <span className="ic-sun"><Icon name="sun" size="sm" /></span>
    </button>
  );
}
