"use client";

import { MenuIcon, XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isInsideToaster } from "@/components/ui/toast";
import { SidebarContent } from "./sidebar";

/**
 * Below 768 px the sidebar becomes this menu (NAV-4): a button in the top bar
 * opening a left sheet with the full sidebar. A modal dialog, so it traps
 * focus, closes on Esc and on the scrim, and returns focus to the button.
 * The button stands in for the nav items in the tour (`data-tour="menu"`).
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Growing past the breakpoint hides the sheet; close it so focus isn't trapped in something invisible.
  useEffect(() => {
    if (!open || !window.matchMedia) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="-ml-1.5 rounded-full md:hidden" aria-label="Menu" data-tour="menu">
          <MenuIcon className="size-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] flex-col overflow-y-auto bg-sidebar p-4 text-sidebar-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left motion-reduce:animate-none md:hidden"
          onInteractOutside={(event) => {
            if (isInsideToaster(event.target)) event.preventDefault();
          }}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <SidebarContent onNavigate={close} />
          <DialogPrimitive.Close
            className="absolute top-4 right-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
            aria-label="Close menu"
          >
            <XIcon className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
