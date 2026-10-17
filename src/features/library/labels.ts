import type { MaterialCost, MaterialLevel, MaterialType } from "@/lib/domain/types";
import type { LengthBucket, ShowOption, SortOption } from "./resource-filters";

/** Display labels for material attributes and resource filters. */

export const TYPE_LABELS: Record<MaterialType, string> = {
  course: "Course",
  certification: "Certification",
  book: "Book",
  article: "Article",
  podcast: "Podcast",
  custom: "Link",
};

export const LEVEL_LABELS: Record<MaterialLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const COST_LABELS: Record<MaterialCost, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
};

export const LENGTH_LABELS: Record<LengthBucket, string> = {
  lt1: "< 1 h",
  "1to5": "1–5 h",
  "5to20": "5–20 h",
  "20plus": "20 h +",
};

export const SHOW_LABELS: Record<ShowOption, string> = {
  all: "All",
  "not-saved": "Not in my library",
  saved: "In my library",
};

export const SORT_LABELS: Record<SortOption, string> = {
  recommended: "Recommended",
  shortest: "Shortest first",
  longest: "Longest first",
  title: "A–Z",
};
