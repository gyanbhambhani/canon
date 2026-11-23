import localFont from "next/font/local";

/**
 * Geist Mono from the geist package, without a preload: it is not needed for the first paint
 * of the headline, and preloading it competed with Geist Sans for bandwidth (Lighthouse LCP).
 */
export const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  adjustFontFallback: false,
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Liberation Mono", "monospace"],
  weight: "100 900",
});
