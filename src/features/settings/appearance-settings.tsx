"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useId, useSyncExternalStore } from "react";
import { Section } from "@/components/app/section";

const MODES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

const subscribeNothing = () => () => {};

/** True after hydration: the stored mode is only known in the browser. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/**
 * Settings → Appearance (ST-5): Light · Dark · System. The same next-themes
 * state as the top-bar toggle, so the two always agree. No theme picker until
 * a second theme exists (T-5).
 */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const name = useId();
  // Unknown on the server: nothing is checked until the browser knows the mode, so hydration matches.
  const current = mounted ? (theme ?? "system") : undefined;

  return (
    <Section title="Appearance">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Mode</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className="relative flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={current === value}
                onChange={() => setTheme(value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <Icon aria-hidden className="size-4 text-muted-foreground" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  );
}
