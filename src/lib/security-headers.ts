/**
 * Response headers for every route (applied in next.config.ts).
 *
 * Visitors may keep their own Claude API key in this browser (ADR 008), so the
 * policy is built to stop it leaving: no third-party scripts, and the page may
 * only connect to itself and the Claude API.
 *
 * Why `script-src 'unsafe-inline'` and not nonces: every page is statically
 * prerendered (Cache Components / partial prerendering), and Next.js inlines
 * per-page flight data as `<script>` tags. Nonces need a fresh, dynamically
 * rendered page per request, which Next's CSP guide notes is incompatible with
 * partial prerendering; hashes can't cover per-page inline data. The XSS
 * surface is small (React escapes all text; no `dangerouslySetInnerHTML`) and
 * `connect-src`, `img-src`, `form-action` and `frame-src` limit where an
 * injected script could send anything.
 */

export const CLAUDE_API_ORIGIN = "https://api.anthropic.com";

export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React needs eval in development only (debug stacks).
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    // next/font self-hosts the fonts.
    "font-src": ["'self'"],
    // Dev server hot reload uses a same-host WebSocket.
    "connect-src": ["'self'", CLAUDE_API_ORIGIN, ...(dev ? ["ws:"] : [])],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

export function securityHeaders({ dev }: { dev: boolean }): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
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
