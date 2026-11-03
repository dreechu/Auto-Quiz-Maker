"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "recall-theme";

export function ThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let dark = false;
    try {
      dark = window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
    } catch (error) {
      console.error("Could not read the saved color theme.", error);
    }
    document.documentElement.classList.toggle("dark", dark);
    buttonRef.current?.setAttribute("aria-pressed", String(dark));
  }, []);

  function toggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextIsDark);
    event.currentTarget.setAttribute("aria-pressed", String(nextIsDark));
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
    } catch (error) {
      console.error("Could not save the selected color theme.", error);
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      aria-pressed={false}
      title="Toggle dark mode"
      className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700"
    >
      <Sun className="theme-toggle-sun" size={17} />
      <Moon className="theme-toggle-moon" size={17} />
    </button>
  );
}
