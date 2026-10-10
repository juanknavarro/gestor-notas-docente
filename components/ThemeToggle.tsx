"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-400">
        <span className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-zinc-400" />
          <span>Tema</span>
        </span>
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Alternar tema"
    >
      <span className="flex items-center gap-2">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-zinc-600 shrink-0" />
        )}
        <span>{isDark ? "Modo Claro" : "Modo Oscuro"}</span>
      </span>
      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-400">
        {isDark ? "Oscuro" : "Claro"}
      </span>
    </button>
  );
}
