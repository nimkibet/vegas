"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { mutate } from "swr";

export function TopNav() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = () => {
    // Re-validate all SWR caches globally
    mutate(() => true, undefined, { revalidate: true });
  };

  return (
    <div className="sticky top-0 z-30 flex h-16 flex-shrink-0 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
      <div className="flex flex-1 justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-2.5">
          <img src="/logo.png" alt="Vegas POS Logo" className="h-7 w-7 object-contain rounded-md ml-12 lg:ml-0" />
          <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
            Dashboard
          </h1>
        </div>
        <div className="ml-4 flex items-center space-x-2 sm:space-x-4">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-full bg-accent/50 p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 focus:outline-none"
            title="Refresh Data"
          >
            <span className="sr-only">Refresh data</span>
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full bg-accent/50 p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 focus:outline-none"
            title="Toggle Theme"
          >
            <span className="sr-only">Toggle theme</span>
            {mounted && theme === "dark" ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
