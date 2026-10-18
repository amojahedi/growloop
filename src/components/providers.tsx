"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toast";
import { useStoreRehydration } from "@/lib/store/hydration";

/** Client-side app providers: theme (light / dark / system), persisted data and toasts. */
export function Providers({ children }: { children: React.ReactNode }) {
  useStoreRehydration();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
