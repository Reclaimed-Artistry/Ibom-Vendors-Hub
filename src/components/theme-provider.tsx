"use client";

import { useContext, createContext } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  toggle: (next: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme provider.
 *
 * The site is locked to dark mode. The toggle and localStorage persistence
 * have been removed so the dark theme is always applied.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const root = document.documentElement;
  root.setAttribute("data-theme", "dark");

  const value: ThemeContextValue = {
    theme: "dark",
    resolvedTheme: "dark",
    toggle: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
