import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SKILL_COLORS } from "@/lib/domain/types";

const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, file), "utf8");
const definedIn = (css: string) => new Set(css.match(/--[a-z0-9-]+(?=\s*:)/g));

const globals = read("../app/globals.css");
const shared = read("tokens.css");
const linen = read("themes/linen.css");

/** Mode-independent tokens, defined once per theme rather than per light/dark block. */
const MODE_INDEPENDENT = /^--(typeface-|radius$|border-width)/;

describe("design tokens", () => {
  it("defines every token that globals.css maps to Tailwind", () => {
    const themeBlock = /@theme inline \{([\s\S]*?)\n\}/.exec(globals)?.[1] ?? "";
    const referenced = [...themeBlock.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]);
    const defined = new Set([...definedIn(shared), ...definedIn(linen)]);

    expect(referenced.length).toBeGreaterThan(50);
    expect(referenced.filter((token) => !defined.has(token))).toEqual([]);
  });

  it("gives Linen's dark mode a value for every light-mode color token", () => {
    const [light, dark] = linen.split(/\n\.dark /);
    const lightTokens = [...definedIn(light)].filter((token) => !MODE_INDEPENDENT.test(token)).sort();
    expect([...definedIn(dark)].sort()).toEqual(lightTokens);
  });

  it("has a token for every skill color", () => {
    const skillTokens = definedIn(shared);
    expect(SKILL_COLORS.filter((color) => !skillTokens.has(`--skill-${color}`))).toEqual([]);
  });
});
