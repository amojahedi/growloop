"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

/**
 * A drawer from the right on desktop and a full-screen sheet below 768 px
 * (card drawer, skill sheet). Built on the dialog primitive, so it traps focus,
 * closes on Esc and on the scrim, and returns focus to the trigger. Sheets can
 * stack (the skill sheet opens over the card drawer). The header and footer
 * stay pinned while the body scrolls.
 */

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

const sheetContentVariants = cva(
  "fixed inset-0 z-50 flex flex-col bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right motion-reduce:animate-none md:left-auto md:w-full md:rounded-l-xl",
  {
    variants: {
      size: {
        /** Card drawer (card-detail.md): 480 px. */
        card: "md:max-w-[30rem]",
        /** Skill sheet (skills.md): 420 px. */
        skill: "md:max-w-[26.25rem]",
      },
    },
    defaultVariants: { size: "card" },
  }
)

function SheetContent({
  className,
  children,
  size,
  closeLabel = "Close",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof sheetContentVariants> & {
    /** Accessible name of the × button. */
    closeLabel?: string
  }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-background/70 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none"
      />
      <DialogPrimitive.Content data-slot="sheet-content" className={cn(sheetContentVariants({ size }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
          aria-label={closeLabel}
        >
          <XIcon className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex shrink-0 flex-col gap-1 border-b px-5 py-4 pr-12", className)} {...props} />
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-body" className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-lg leading-snug font-medium", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
