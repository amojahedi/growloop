"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { hiddenWidgets } from "@/lib/domain/dashboard-layout";
import { useDashboardLayout, useLayoutEditor } from "./layout-editor";
import { WIDGETS } from "./widget-registry";

/** Gallery of hidden widgets; adding one puts it at the end of the dashboard. */
export function AddWidgetDialog() {
  const [open, setOpen] = useState(false);
  const { layout } = useDashboardLayout();
  const dispatch = useLayoutEditor((state) => state.dispatch);
  const available = hiddenWidgets(layout, WIDGETS);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon aria-hidden />
          Add widget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
          <DialogDescription>Widgets are added at the end of your dashboard.</DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-muted-foreground">Every widget is already on your dashboard.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {available.map((widget) => (
              <li key={widget.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{widget.title}</p>
                  <p className="text-muted-foreground">{widget.description}</p>
                </div>
                <Button
                  size="sm"
                  aria-label={`Add ${widget.title}`}
                  onClick={() => {
                    dispatch({ type: "add", widgetId: widget.id, size: widget.defaultSize });
                    setOpen(false);
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
