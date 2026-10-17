"use client";

import { ThemeProvider } from "next-themes";
import { useStoreRehydration } from "@/lib/store/hydration";

/** Client-side app providers: theme (light / dark / system) and persisted data. */
export function Providers({ children }: { children: React.ReactNode }) {
  useStoreRehydration();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
