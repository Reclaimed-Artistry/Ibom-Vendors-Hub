"use client";

import { useContext, createContext, useEffect } from "react";
import type { ReactNode } from "react";

type Theme = "light";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme provider.
 *
 * The site is locked to light mode. Dark mode, the theme toggle, localStorage
 * persistence, and system preference detection have all been removed.
 *
 * DOM access is deferred to useEffect to avoid `document is not defined`
 * during server-side rendering.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
  }, []);

  const value: ThemeContextValue = {
    theme: "light",
    resolvedTheme: "light",
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
