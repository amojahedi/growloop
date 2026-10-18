"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { create } from "zustand"

/**
 * Toasts (specs/README.md §Toasts): bottom-right on desktop, bottom-center on
 * mobile, announced politely, 6 s (8 s with an action such as Undo), at most
 * one at a time; a new toast replaces the old one. The timer pauses while the
 * pointer or keyboard focus is on the toast, so there's time to reach Undo.
 *
 *   toast({ message: "Removed from October", action: { label: "Undo", onClick: restore } })
 */

export const TOAST_DURATION_MS = 6_000
export const TOAST_WITH_ACTION_DURATION_MS = 8_000

export interface ToastOptions {
  message: string
  action?: { label: string; onClick: () => void }
  /** Overrides the default duration, in ms. */
  duration?: number
}

interface ActiveToast extends ToastOptions {
  id: number
}

const useToastStore = create<{ current: ActiveToast | null }>(() => ({ current: null }))
let nextId = 0

/** Shows a toast, replacing any visible one. */
export function toast(options: ToastOptions): void {
  nextId += 1
  useToastStore.setState({ current: { ...options, id: nextId } })
}

/** Hides the visible toast. */
export function dismissToast(): void {
  useToastStore.setState({ current: null })
}

/** Renders the visible toast. Mount once, near the root (see Providers). */
export function Toaster() {
  const current = useToastStore((state) => state.current)
  // Keyed by toast, so a replacement toast never starts out paused.
  const [pausedId, setPausedId] = React.useState<number | null>(null)
  const paused = current !== null && pausedId === current.id

  React.useEffect(() => {
    if (!current || paused) return
    const duration = current.duration ?? (current.action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS)
    const timer = setTimeout(() => {
      // Only hide this toast; a newer one keeps its own timer.
      if (useToastStore.getState().current?.id === current.id) dismissToast()
    }, duration)
    return () => clearTimeout(timer)
  }, [current, paused])

  return (
    // The live region is always present, so screen readers announce toasts added to it.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 md:inset-x-auto md:right-4 md:justify-end"
    >
      {current && (
        <div
          key={current.id}
          className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg bg-foreground py-2.5 pr-2 pl-4 text-sm text-background shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2"
          onMouseEnter={() => setPausedId(current.id)}
          onMouseLeave={() => setPausedId(null)}
          onFocus={() => setPausedId(current.id)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPausedId(null)
          }}
        >
          <p className="min-w-0 flex-1">{current.message}</p>
          {current.action && (
            <button
              type="button"
              className="shrink-0 rounded-md px-2 py-1 font-medium underline underline-offset-4 hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-background focus-visible:outline-hidden"
              onClick={() => {
                current.action?.onClick()
                dismissToast()
              }}
            >
              {current.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 opacity-80 hover:bg-background/15 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-background focus-visible:outline-hidden"
            onClick={dismissToast}
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
