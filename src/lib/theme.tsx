// src/lib/theme.tsx
"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContext = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const Ctx = createContext<ThemeContext>({ theme: "system", resolved: "light", setTheme: () => {} });
export const useTheme = () => useContext(Ctx);

function getStored(): Theme {
  try { return (localStorage.getItem("kp-theme") as Theme) || "system"; } catch { return "system"; }
}

function resolve(t: Theme): "light" | "dark" {
  if (t === "dark") return "dark";
  if (t === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(t: Theme) {
  const root = document.documentElement;
  const resolved = resolve(t);
  root.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0f111a" : "#7c3aed");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize synchronously from what the inline script already set on <html>
  const initialDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [theme, setThemeState] = useState<Theme>(getStored);
  const [resolved, setResolved] = useState<"light" | "dark">(initialDark ? "dark" : "light");

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(resolve(t));
    try { localStorage.setItem("kp-theme", t); } catch {}
    apply(t);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const stored = getStored();
      if (stored === "system") {
        setResolved(resolve("system"));
        apply("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}
