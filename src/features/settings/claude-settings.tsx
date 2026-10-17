"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiKeyFormatProblem, forgetApiKey, saveApiKey, useClaudeApiKey } from "@/lib/ai/api-key-storage";
import { testApiKey } from "@/lib/ai/providers/own-key";
import { AIRequestError } from "@/lib/ai/request-error";
import { useAI, type UseAI } from "@/lib/ai/use-ai";

type Feedback = { tone: "info" | "success" | "error"; text: string };

function statusLine({ provider, status }: Pick<UseAI, "provider" | "status">): string {
  if (provider === "own-key") return "Using your key";
  if (provider === "local") return "Using Claude Code on this computer";
  return status.state === "checking" ? "Checking…" : "AI is off";
}

/**
 * "Claude" settings (ADR 008): the visitor's own API key, kept in this browser
 * only and sent only to Anthropic. The key is never displayed or logged.
 */
export function ClaudeSettings() {
  const ai = useAI();
  const savedKey = useClaudeApiKey();
  const inputId = useId();
  const noticeId = useId();
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<Feedback>();
  const [testing, setTesting] = useState(false);
  const testRef = useRef<AbortController | null>(null);

  useEffect(() => () => testRef.current?.abort(), []);

  const cancelTest = () => {
    testRef.current?.abort();
    testRef.current = null;
    setTesting(false);
  };

  const save = () => {
    const problem = apiKeyFormatProblem(draft);
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }
    cancelTest();
    const saved = saveApiKey(draft);
    setDraft("");
    setFeedback(
      saved
        ? { tone: "success", text: "Key saved in this browser." }
        : { tone: "error", text: "This browser blocked saving the key (site data may be disabled)." },
    );
  };

  const test = async () => {
    const key = draft.trim() || savedKey;
    if (!key) return;
    const problem = apiKeyFormatProblem(key);
    if (problem) {
      setFeedback({ tone: "error", text: problem });
      return;
    }

    testRef.current?.abort();
    const controller = new AbortController();
    testRef.current = controller;
    setTesting(true);
    setFeedback({ tone: "info", text: "Testing the key…" });
    try {
      await testApiKey(key, controller.signal);
      if (controller.signal.aborted) return;
      setFeedback({ tone: "success", text: draft.trim() ? "The key works. Save it to use it." : "Your key works." });
    } catch (error) {
      if (controller.signal.aborted) return;
      setFeedback({
        tone: "error",
        text: error instanceof AIRequestError ? error.message : "Couldn't test the key.",
      });
    } finally {
      if (testRef.current === controller) {
        testRef.current = null;
        setTesting(false);
      }
    }
  };

  const forget = () => {
    cancelTest();
    forgetApiKey();
    setDraft("");
    setFeedback({ tone: "info", text: "Key removed from this browser." });
  };

  return (
    <div id="claude" className="scroll-mt-6">
      <Section title="Claude" description="AI features use your own Claude API key, or Claude Code when Growloop runs on your computer.">
        <div className="flex flex-col gap-4">
          <p className="text-sm" role="status" aria-live="polite">
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">{statusLine(ai)}</span>
          </p>

          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
              Claude API key
            </label>
            <Input
              id={inputId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              placeholder={savedKey ? "A key is saved. Paste a new one to replace it." : "sk-ant-…"}
              value={draft}
              aria-describedby={noticeId}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={!draft.trim()}>
                Save key
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testing || (!draft.trim() && !savedKey)}
                onClick={() => void test()}
              >
                {testing ? "Testing…" : "Test key"}
              </Button>
              {savedKey && (
                <Button type="button" variant="destructive" size="sm" onClick={forget}>
                  Forget key
                </Button>
              )}
            </div>
            {feedback && (
              <p
                className={
                  feedback.tone === "error"
                    ? "text-sm text-destructive"
                    : feedback.tone === "success"
                      ? "text-sm text-foreground"
                      : "text-sm text-muted-foreground"
                }
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.text}
              </p>
            )}
          </form>

          <p id={noticeId} className="text-xs text-muted-foreground">
            Your key stays in this browser only and is sent only to Anthropic, directly from your browser. It is never
            included in exports. Anyone with access to this browser profile could read it, so use{" "}
            <span className="font-medium">Forget key</span> on shared computers. Create a key in the{" "}
            <a
              href="https://platform.claude.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Claude Console
            </a>
            .
          </p>
        </div>
      </Section>
    </div>
  );
}
