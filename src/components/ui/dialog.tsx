"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { isInsideToaster } from "./toast"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/** "center" is a classic modal; "right" and "bottom" are sheets (side panels). */
const dialogContentVariants = cva(
  "fixed z-50 flex flex-col gap-4 overflow-y-auto bg-popover p-5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
  {
    variants: {
      side: {
        center:
          "top-1/2 left-1/2 max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl data-open:zoom-in-95 data-closed:zoom-out-95",
        right:
          "inset-y-0 right-0 h-full w-full max-w-md data-open:slide-in-from-right data-closed:slide-out-to-right sm:rounded-l-xl",
        bottom:
          "inset-x-0 bottom-0 max-h-[85svh] rounded-t-xl data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
      },
    },
    defaultVariants: { side: "center" },
  }
)

function DialogContent({
  className,
  children,
  side,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & VariantProps<typeof dialogContentVariants>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-background/70 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ side }), className)}
        // Undo on a toast must not close the dialog it undoes something in.
        onInteractOutside={(event) => {
          if (isInsideToaster(event.target)) event.preventDefault()
          onInteractOutside?.(event)
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
          aria-label="Close"
        >
          <XIcon className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1 pr-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("font-heading text-base leading-snug font-medium", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger }
