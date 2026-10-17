"use client";

import { Settings2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { sameLayout } from "@/lib/domain/dashboard-layout";
import { useActions } from "@/lib/store/hooks";
import { AddWidgetDialog } from "./add-widget-dialog";
import { useDashboardLayout, useLayoutEditor } from "./layout-editor";
import { DEFAULT_LAYOUT } from "./widget-registry";

/** Dashboard header controls: Customize, then Add widget / Reset / Cancel / Done while editing (D-8). */
export function CustomizeToolbar() {
  const { layout, saved, editing } = useDashboardLayout();
  const start = useLayoutEditor((state) => state.start);
  const stop = useLayoutEditor((state) => state.stop);
  const dispatch = useLayoutEditor((state) => state.dispatch);
  const { setDashboardLayout } = useActions();

  // The button that was clicked is replaced by the other mode's controls; keep focus in the toolbar.
  const customizeRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (editing ? doneRef : customizeRef).current?.focus();
  }, [editing]);

  const toggle = (action: () => void) => () => {
    toggled.current = true;
    action();
  };
  // A layout equal to the default is stored as "default", so it picks up future default changes.
  const save = () => setDashboardLayout(sameLayout(layout, DEFAULT_LAYOUT) ? null : layout);

  if (!editing) {
    return (
      <Button ref={customizeRef} variant="outline" size="sm" onClick={toggle(() => start(saved))}>
        <Settings2Icon aria-hidden />
        Customize
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Edit dashboard layout" className="flex flex-wrap items-center gap-2">
      <AddWidgetDialog />
      <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "replace", layout: DEFAULT_LAYOUT })}>
        Reset to default
      </Button>
      <Button variant="outline" size="sm" onClick={toggle(stop)}>
        Cancel
      </Button>
      <Button
        ref={doneRef}
        size="sm"
        onClick={toggle(() => {
          save();
          stop();
        })}
      >
        Done
      </Button>
    </div>
  );
}
