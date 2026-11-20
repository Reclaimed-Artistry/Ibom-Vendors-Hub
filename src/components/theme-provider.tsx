"use client";

import { useCallback, useContext, useEffect, useState, type ReactNode, createContext } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  toggle: (next: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  storageKey = "ivh-theme",
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored) setTheme(stored);
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    const resolve = (t: Theme) => {
      if (t === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return t;
    };
    const resolved = resolve(theme);
    setResolvedTheme(resolved);
    root.setAttribute("data-theme", resolved);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        const resolved = media.matches ? "dark" : "light";
        setResolvedTheme(resolved);
        document.documentElement.setAttribute("data-theme", resolved);
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme, mounted]);

  const toggle = useCallback(
    (next: Theme) => {
      setTheme(next);
      localStorage.setItem(storageKey, next);
    },
    [storageKey],
  );

  const value: ThemeContextValue = { theme, resolvedTheme, toggle };

  if (!mounted) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function ThemeToggleButton() {
  const { theme, resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nextTheme =
    theme === "dark" ? "system" : theme === "system" ? "light" : "dark";
  const labels: Record<Theme, string> = {
    light: "Light",
    dark: "Dark",
    system: "System",
  };

  return (
    <button
      type="button"
      onClick={() => toggle(nextTheme)}
      className="rounded-full p-2 text-ink-600 hover:bg-ink-100 hover:text-brand-700 transition-colors"
      aria-label={`Switch theme (currently ${labels[theme]})`}
      title={`Theme: ${labels[theme]} — click to switch`}
    >
      {isDark ? (
        <Sun className="size-5 shrink-0 text-amber-500" />
      ) : (
        <Moon className="size-5 shrink-0 text-ink-500" />
      )}
      <span className="sr-only">{labels[theme]}</span>
    </button>
  );
}
