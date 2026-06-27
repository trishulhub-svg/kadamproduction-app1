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
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#05070a" : "#f8fafc");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const [theme, setThemeState] = useState<Theme>(getStored);
  const [resolved, setResolved] = useState<"light" | "dark">(initialDark ? "dark" : "light");

  const setTheme = useCallback((t: Theme) => {
    const el = document.getElementById("theme-overlay");
    if (el) {
      el.style.display = "block";
      el.style.animation = "none";
      void el.offsetHeight;
      el.style.animation = "theme-wipe-in 1s cubic-bezier(0.65, 0, 0.35, 1) forwards";

      requestAnimationFrame(() => {
        setTimeout(() => {
          setThemeState(t);
          setResolved(resolve(t));
          try { localStorage.setItem("kp-theme", t); } catch {}
          apply(t);

          el.style.animation = "none";
          void el.offsetHeight;
          el.style.animation = "theme-wipe-out 1s cubic-bezier(0.65, 0, 0.35, 1) forwards";

          setTimeout(() => { el.style.display = "none"; }, 1200);
        }, 1100);
      });
    } else {
      setThemeState(t);
      setResolved(resolve(t));
      try { localStorage.setItem("kp-theme", t); } catch {}
      apply(t);
    }
  }, []);

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

  return (
    <Ctx.Provider value={{ theme, resolved, setTheme }}>
      {children}
      <div
        id="theme-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "var(--bg)",
          display: "none",
          pointerEvents: "none",
          clipPath: "circle(0% at 50% 50%)",
        }}
      />
    </Ctx.Provider>
  );
}
