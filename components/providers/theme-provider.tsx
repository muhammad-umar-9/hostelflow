"use client";

import * as React from "react";

type Theme = "navy" | "green" | "teal";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const THEME_KEY = "hostelflow.theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("navy");

  // Hydrating the stored theme after mount keeps the server and client markup identical.
  // TODO(backend milestone): move the theme to a cookie read on the server so the correct
  // palette is rendered on the first paint, which also removes this suppression.
  React.useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === "navy" || stored === "green" || stored === "teal") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off hydration of a client-only preference
      setThemeState(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
