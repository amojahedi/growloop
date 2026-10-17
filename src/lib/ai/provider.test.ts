import { describe, expect, it } from "vitest";
import { offProvider, selectProviderKind } from "./provider";
import { localProvider } from "./providers/local";
import { createOwnKeyProvider } from "./providers/own-key";

describe("selectProviderKind", () => {
  it("prefers the visitor's own key over local Claude Code", () => {
    expect(selectProviderKind({ apiKey: "sk-ant-test", localAvailable: true })).toBe("own-key");
    expect(selectProviderKind({ apiKey: "sk-ant-test", localAvailable: false })).toBe("own-key");
  });

  it("uses local Claude Code only when it is available", () => {
    expect(selectProviderKind({ apiKey: null, localAvailable: true })).toBe("local");
  });

  it("is off without a key or local Claude Code", () => {
    expect(selectProviderKind({ apiKey: null, localAvailable: false })).toBe("off");
    expect(selectProviderKind({ apiKey: "", localAvailable: false })).toBe("off");
  });
});

describe("providers", () => {
  it("expose the same interface", () => {
    const methods = ["recommend", "refineSummary", "enrichMaterial", "draftOkrs"];
    for (const provider of [offProvider, localProvider, createOwnKeyProvider("sk-ant-test")]) {
      for (const method of methods) expect(provider).toHaveProperty(method, expect.any(Function));
    }
    expect([offProvider.kind, localProvider.kind, createOwnKeyProvider("sk-ant-test").kind]).toEqual(["off", "local", "own-key"]);
  });

  it("off rejects every call with a pointer to Settings", async () => {
    await expect(offProvider.recommend({ context: { kind: "skill", name: "Roadmapping" } })).rejects.toMatchObject({
      code: "off",
      message: expect.stringContaining("Settings"),
    });
  });

  it("draftOkrs is a stub until the OKR wizard implements it", async () => {
    await expect(localProvider.draftOkrs({ answers: [], skills: [] })).rejects.toMatchObject({ code: "not-implemented" });
    await expect(createOwnKeyProvider("sk-ant-test").draftOkrs({ answers: [], skills: [] })).rejects.toMatchObject({
      code: "not-implemented",
    });
  });
});
