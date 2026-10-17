import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { contentSecurityPolicy } from "./security-headers";

const directive = (policy: string, name: string) =>
  policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe("security headers", () => {
  it("are applied to every route by next.config", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");

    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers["Content-Security-Policy"]).toContain("connect-src 'self' https://api.anthropic.com");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("only lets the page talk to itself and the Claude API, with no third-party scripts", () => {
    const policy = contentSecurityPolicy({ dev: false });
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' https://api.anthropic.com");
    expect(directive(policy, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(directive(policy, "default-src")).toBe("default-src 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(policy).not.toMatch(/https:\/\/(?!api\.anthropic\.com)/);
  });

  it("allows eval and hot reload in development only", () => {
    expect(contentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: true }), "connect-src")).toContain("ws:");
    expect(contentSecurityPolicy({ dev: false })).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy({ dev: false })).not.toContain("ws:");
  });
});
