"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectProviderKind, type AIProviderKind } from "@/lib/ai/provider";
import { forgetApiKey, isMalformedApiKey, saveApiKey, useApiKeyLast4, useHasApiKey } from "@/lib/ai/providers/key-storage";
import { validateApiKey } from "@/lib/ai/providers/own-key";
import { AIRequestError } from "@/lib/ai/request-error";
import { useLocalClaudeStatus, type AIStatusState } from "@/lib/ai/use-ai";
import { cn } from "@/lib/utils";

/**
 * Settings → Claude (docs/product/specs/settings-and-ai-keys.md, ADR 008).
 *
 * The pasted key lives only in the uncontrolled input until it's saved (never
 * in React state); afterwards the UI only sees "a key is saved" and its last
 * four characters. The field opts out of password managers, and there's no
 * <form>, so nothing offers to remember the key.
 */

type Feedback = { tone: "info" | "success" | "error"; text: string };

const KEY_DIDNT_WORK = "That key didn't work. Check it and try again.";
const UNREACHABLE = "Couldn't reach Anthropic. Check your connection and try again.";

const STATUS_LINE: Record<AIProviderKind | "checking" | "off", { on: boolean; text: string }> = {
  key: { on: true, text: "Claude is on · your API key" },
  local: { on: true, text: "Claude is on · Claude Code on this computer" },
  checking: { on: false, text: "Checking Claude…" },
  off: { on: false, text: "Claude is off" },
};

/** Attributes that keep password managers from offering to save or fill the key. */
const NO_PASSWORD_MANAGER = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

export function ClaudeSettings() {
  const hasKey = useHasApiKey();
  const last4 = useApiKeyLast4();
  const local = useLocalClaudeStatus();
  const provider = selectProviderKind({ hasKey, localAvailable: local.status.state === "available" });
  const status = STATUS_LINE[!hasKey && local.status.state === "checking" ? "checking" : (provider ?? "off")];

  const inputId = useId();
  const noticeId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const checkRef = useRef<AbortController | null>(null);

  useEffect(() => () => checkRef.current?.abort(), []);

  const save = async () => {
    const input = inputRef.current;
    const key = input?.value.trim() ?? "";
    if (!key || checking) return;
    // Obviously wrong formats get the same message, without a network call.
    if (isMalformedApiKey(key)) {
      setFeedback({ tone: "error", text: KEY_DIDNT_WORK });
      return;
    }

    checkRef.current?.abort();
    const controller = new AbortController();
    checkRef.current = controller;
    setChecking(true);
    setFeedback(undefined);
    try {
      await validateApiKey(key, controller.signal);
      if (controller.signal.aborted) return;
      const stored = saveApiKey(key);
      if (input) input.value = "";
      setHasDraft(false);
      setFeedback(
        stored === "memory"
          ? { tone: "info", text: "Your browser blocks storage, so the key lasts only for this tab." }
          : { tone: "success", text: "Claude is on." },
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      // Nothing is stored on failure.
      const code = error instanceof AIRequestError ? error.code : undefined;
      setFeedback({
        tone: "error",
        text:
          code === "key-rejected" || code === "forbidden"
            ? KEY_DIDNT_WORK
            : code === "network" || code === "timeout"
              ? UNREACHABLE
              : error instanceof AIRequestError
                ? error.message
                : KEY_DIDNT_WORK,
      });
    } finally {
      if (checkRef.current === controller) {
        checkRef.current = null;
        setChecking(false);
      }
    }
  };

  const forget = () => {
    forgetApiKey();
    setFeedback({ tone: "info", text: "Key forgotten. It's no longer stored in this browser." });
  };

  // Claude Code only exists when the server is reached via localhost.
  const showClaudeCode =
    local.status.state !== "unavailable" || local.status.code !== "disabled";

  return (
    <div id="claude" className="scroll-mt-6">
      <Section
        title="Claude"
        description="Claude can draft your yearly plan, fill in resources you paste, recommend what to learn and give feedback on your summaries. Everything else works without it."
        action={
          <p className="flex items-center gap-1.5 text-sm" role="status" aria-live="polite">
            <span aria-hidden className={status.on ? "text-primary" : "text-muted-foreground"}>
              {status.on ? "●" : "○"}
            </span>
            <span className="font-medium">{status.text}</span>
          </p>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground">Each Claude action uses your own API credit, usually a few cents.</p>

          <div className="flex flex-col gap-2">
            <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
              Your Claude API key
              {!hasKey && local.status.state === "available" && (
                <span className="font-normal"> · Optional: use an API key instead</span>
              )}
            </label>
            {hasKey ? (
              <div className="flex flex-wrap items-center gap-2">
                <p
                  id={inputId}
                  className="min-w-0 flex-1 rounded-lg border border-input px-2.5 py-1 font-mono text-sm text-muted-foreground"
                  aria-label={`Saved key ending in ${last4}`}
                >
                  {"•".repeat(24)}
                  {last4}
                </p>
                <Button type="button" variant="destructive" size="sm" onClick={forget}>
                  Forget key
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  ref={inputRef}
                  id={inputId}
                  type="password"
                  {...NO_PASSWORD_MANAGER}
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder="sk-ant-…"
                  className="min-w-0 flex-1"
                  aria-describedby={noticeId}
                  onChange={(event) => setHasDraft(event.target.value.trim() !== "")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void save();
                    }
                  }}
                />
                <Button type="button" size="sm" disabled={!hasDraft || checking} onClick={() => void save()}>
                  {checking ? "Checking…" : "Save key"}
                </Button>
              </div>
            )}
            {feedback && (
              <p
                className={cn(
                  "text-sm",
                  feedback.tone === "error" ? "text-destructive" : feedback.tone === "success" ? "text-foreground" : "text-muted-foreground",
                )}
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.text}
              </p>
            )}
            <p id={noticeId} className="text-xs text-muted-foreground">
              Your key stays in this browser and goes only to Anthropic. Growloop&apos;s server never sees it. Anyone who
              can use this browser profile could read it, so set a spending limit on the key and forget it on shared
              computers.{" "}
              <a
                href="https://platform.claude.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                Get a key ↗
              </a>
            </p>
          </div>

          {showClaudeCode && <ClaudeCodeRow status={local.status} hasKey={hasKey} onRecheck={local.recheck} />}
        </div>
      </Section>
    </div>
  );
}

function ClaudeCodeRow({ status, hasKey, onRecheck }: { status: AIStatusState; hasKey: boolean; onRecheck: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">Claude Code on this computer</p>
        <p className="text-muted-foreground">
          {status.state === "checking"
            ? "Checking…"
            : status.state === "available"
              ? hasKey
                ? "Found · not used while your API key is saved"
                : "Found · signed in"
              : "Not available"}{" "}
          <span className="text-xs">(local only)</span>
        </p>
      </div>
      {status.state === "unavailable" && (
        <div className="flex flex-col gap-1 text-muted-foreground">
          {status.reason && <p>{status.reason}</p>}
          <ol className="list-inside list-decimal">
            <li>Install Claude Code.</li>
            <li>
              Run <code>claude</code> once to sign in.
            </li>
            <li>Restart Growloop.</li>
          </ol>
          <Button type="button" variant="ghost" size="xs" className="self-start" onClick={onRecheck}>
            Check again
          </Button>
        </div>
      )}
    </div>
  );
}
