import type { BoardStatus } from "@/lib/domain/types";

export const STATUS_LABELS: Record<BoardStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
