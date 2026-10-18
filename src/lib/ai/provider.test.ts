import { describe, expect, it } from "vitest";
import { offProvider, selectProviderKind } from "./provider";
import { localProvider } from "./providers/local";
import { ownKeyProvider } from "./providers/own-key";

describe("selectProviderKind", () => {
  it("prefers the visitor's own key over local Claude Code", () => {
    expect(selectProviderKind({ hasKey: true, localAvailable: true })).toBe("key");
    expect(selectProviderKind({ hasKey: true, localAvailable: false })).toBe("key");
  });

  it("uses local Claude Code only when it is available", () => {
    expect(selectProviderKind({ hasKey: false, localAvailable: true })).toBe("local");
  });

  it("is off (null) without a key or local Claude Code", () => {
    expect(selectProviderKind({ hasKey: false, localAvailable: false })).toBeNull();
  });
});

describe("providers", () => {
  it("expose the same interface", () => {
    const methods = ["recommend", "refineSummary", "enrichMaterial", "draftPlan"];
    for (const provider of [offProvider, localProvider, ownKeyProvider]) {
      for (const method of methods) expect(provider).toHaveProperty(method, expect.any(Function));
    }
    expect([offProvider.kind, localProvider.kind, ownKeyProvider.kind]).toEqual([null, "local", "key"]);
  });

  it("off rejects every call with a pointer to Settings", async () => {
    await expect(offProvider.recommend({ context: { kind: "skill", name: "Roadmapping" } })).rejects.toMatchObject({
      code: "off",
      message: expect.stringContaining("Settings"),
    });
  });
});
