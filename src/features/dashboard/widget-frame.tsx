"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WidgetPlacement, WidgetSize } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { SizePicker } from "./size-picker";
import type { WidgetDefinition } from "./widget-registry";

// Static class names so Tailwind can see them. Stacks on mobile; tablets get two columns.
const SPAN: Record<WidgetSize, string> = {
  small: "md:col-span-1 lg:col-span-1",
  medium: "md:col-span-2 lg:col-span-2",
  large: "md:col-span-2 lg:col-span-3",
};

interface WidgetFrameProps {
  placement: WidgetPlacement;
  widget: WidgetDefinition;
  editing: boolean;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}

/** One grid cell: the widget, plus a drag handle, size picker and remove button in edit mode. */
export function WidgetFrame({ placement, widget, editing, onResize, onRemove }: WidgetFrameProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: placement.widgetId,
    disabled: !editing,
  });
  const Widget = widget.component;

  return (
    <li
      ref={setNodeRef}
      data-widget-id={placement.widgetId}
      // Translate only: scaling would distort widgets of different sizes while they swap places.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex min-w-0 flex-col gap-2", SPAN[placement.size], isDragging && "relative z-10 opacity-80")}
    >
      {editing && (
        <div className="flex items-center gap-1 rounded-lg bg-muted px-1 py-1">
          <Button
            ref={setActivatorNodeRef}
            variant="ghost"
            size="icon-sm"
            className="cursor-grab touch-none active:cursor-grabbing"
            data-widget-handle
            {...attributes}
            {...listeners}
            aria-label={`Move ${widget.title}`}
          >
            <GripVerticalIcon />
          </Button>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{widget.title}</span>
          <SizePicker widgetTitle={widget.title} value={placement.size} onChange={onResize} />
          {!widget.locked && (
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${widget.title}`}>
              <XIcon />
            </Button>
          )}
        </div>
      )}
      {/* Inert while editing, so widget controls can't be used or tabbed to mid-edit. */}
      <div inert={editing} className={cn("flex-1", editing && "rounded-xl outline-2 outline-offset-2 outline-dashed outline-border")}>
        <Widget />
      </div>
    </li>
  );
}
