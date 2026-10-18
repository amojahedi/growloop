import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Growloop", template: "%s · Growloop" },
  description:
    "Grow on purpose, a month at a time. Set a few goals for the year, learn a little each month, and keep what sticks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-style selects the token set in src/styles/themes. suppressHydrationWarning: next-themes sets
    // the light/dark class before paint.
    <html lang="en" data-style="linen" className={cn(fontVariables, "h-full antialiased")} suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
