import { DM_Sans, Fraunces } from "next/font/google";

/**
 * Typefaces exposed as CSS variables on <html>; the theme's token file maps
 * them to `--typeface-*`. Linen: Fraunces (display, numbers) + DM Sans (UI).
 */
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const fontVariables = `${fraunces.variable} ${dmSans.variable}`;
