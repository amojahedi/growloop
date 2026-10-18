"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { ESCAPE_LOCAL } from "@/components/notes/escape-local";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { taskProgress } from "@/lib/domain/plan-items";
import type { PlanItem, Task } from "@/lib/domain/types";
import { useActions } from "@/lib/store/hooks";
import { CardSection } from "./card-section";

/**
 * Tasks (C-2): check, rename on click, delete (×, shown on hover and focus,
 * always on touch), and "+ Add a task", where Enter adds and keeps the field
 * open for the next one. Read-only cards show the list without controls.
 */
export function CardTasks({ item, readOnly }: { item: PlanItem; readOnly: boolean }) {
  const { done, total } = taskProgress(item);
  if (readOnly && total === 0) return null;

  return (
    <CardSection title="Tasks" detail={total > 0 && <span className="text-xs text-muted-foreground tabular-nums">{done} of {total}</span>}>
      {total > 0 && (
        <ul className="flex flex-col">
          {item.tasks.map((task) => (
            <TaskRow key={task.id} itemId={item.id} task={task} readOnly={readOnly} />
          ))}
        </ul>
      )}
      {!readOnly && <AddTask itemId={item.id} />}
    </CardSection>
  );
}

function TaskRow({ itemId, task, readOnly }: { itemId: string; task: Task; readOnly: boolean }) {
  const { setTaskDone, renameTask, deleteTask } = useActions();
  const [editing, setEditing] = useState(false);
  const renameRef = useRef<HTMLButtonElement>(null);
  // Enter or Escape already finished; the blur that follows must not finish again.
  const finished = useRef(false);

  const finishRename = (title: string | null) => {
    if (finished.current) return;
    finished.current = true;
    setEditing(false);
    if (title !== null && title.trim() && title.trim() !== task.title) renameTask(itemId, task.id, title);
    requestAnimationFrame(() => renameRef.current?.focus());
  };

  return (
    <li className="group flex min-h-9 items-center gap-2.5 rounded-md px-1 hover:bg-muted/60">
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-primary"
        checked={task.done}
        disabled={readOnly}
        aria-label={task.title}
        onChange={(event) => setTaskDone(itemId, task.id, event.target.checked)}
      />
      {editing ? (
        <Input
          {...ESCAPE_LOCAL}
          aria-label={`Rename task ${task.title}`}
          defaultValue={task.title}
          autoFocus
          className="h-7"
          onBlur={(event) => finishRename(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finishRename(event.currentTarget.value);
            if (event.key === "Escape") finishRename(null);
          }}
        />
      ) : readOnly ? (
        <span className={task.done ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
      ) : (
        <button
          ref={renameRef}
          type="button"
          aria-label={`Rename ${task.title}`}
          className={`min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${task.done ? "text-muted-foreground line-through" : ""}`}
          onClick={() => {
            finished.current = false;
            setEditing(true);
          }}
        >
          {task.title}
        </button>
      )}
      {!readOnly && !editing && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={`Delete ${task.title}`}
          onClick={() => deleteTask(itemId, task.id)}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </li>
  );
}

function AddTask({ itemId }: { itemId: string }) {
  const { addTask } = useActions();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Escape closes without adding; the blur that follows must not add what was typed.
  const cancelled = useRef(false);

  const close = () => {
    cancelled.current = true;
    setAdding(false);
    setTitle("");
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  if (!adding) {
    return (
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={() => {
          cancelled.current = false;
          setAdding(true);
        }}
      >
        <PlusIcon aria-hidden />
        Add a task
      </Button>
    );
  }

  return (
    <Input
      {...ESCAPE_LOCAL}
      aria-label="New task"
      placeholder="What's the next step?"
      autoFocus
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={() => {
        if (cancelled.current) return;
        if (title.trim()) addTask(itemId, title);
        setAdding(false);
        setTitle("");
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (!title.trim()) return close();
          addTask(itemId, title);
          // Keep the field open and focused for the next task.
          setTitle("");
        }
        if (event.key === "Escape") close();
      }}
    />
  );
}
