import {
  MATERIAL_COSTS,
  MATERIAL_LEVELS,
  MATERIAL_TYPES,
  type ID,
  type Material,
  type MaterialCost,
  type MaterialLevel,
  type MaterialType,
} from "@/lib/domain/types";

/**
 * Resource filtering and sorting (PRD RS-2), as pure functions. Options within
 * one category are OR-ed (book or podcast); categories are AND-ed (a book that
 * is also free). An empty category means "no constraint".
 */

export const LENGTH_BUCKETS = ["lt1", "1to5", "5to20", "20plus"] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export const SHOW_OPTIONS = ["all", "not-saved", "saved"] as const;
export type ShowOption = (typeof SHOW_OPTIONS)[number];

export const SORT_OPTIONS = ["recommended", "shortest", "longest", "title"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** The filterable types: "custom" is how the user's own links are stored, not a catalog type. */
export const FILTER_TYPES = MATERIAL_TYPES.filter((type) => type !== "custom") as Exclude<MaterialType, "custom">[];
export const FILTER_LEVELS: readonly MaterialLevel[] = MATERIAL_LEVELS;
export const FILTER_COSTS: readonly MaterialCost[] = MATERIAL_COSTS;

export interface ResourceFilters {
  /** Free-text search over title, author, tagline and takeaways. */
  query: string;
  skills: ID[];
  types: MaterialType[];
  levels: MaterialLevel[];
  costs: MaterialCost[];
  lengths: LengthBucket[];
  show: ShowOption;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ResourceFilters = {
  query: "",
  skills: [],
  types: [],
  levels: [],
  costs: [],
  lengths: [],
  show: "all",
  sort: "recommended",
};

/** The multi-select categories, in display order. */
export type FilterCategory = "skills" | "types" | "levels" | "costs" | "lengths";

/** Which length bucket an estimate falls in; `undefined` when the length is unknown. */
export function lengthBucketOf(hours: number | undefined): LengthBucket | undefined {
  if (hours === undefined) return undefined;
  if (hours < 1) return "lt1";
  if (hours <= 5) return "1to5";
  if (hours <= 20) return "5to20";
  return "20plus";
}

/** Lower-cased and accent-free, so "Café" matches "cafe". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Search terms: every term must appear somewhere in the material's searchable text. */
export function searchTerms(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

function searchableText(material: Material): string {
  return normalize([material.title, material.author, material.tagline, ...material.keyTakeaways].join("\n"));
}

const matchesAny = <T>(selected: readonly T[], value: T | undefined) =>
  selected.length === 0 || (value !== undefined && selected.includes(value));

export interface FilterContext {
  /** Everything in My Library: saved curated ids plus the user's own materials. */
  libraryIds: ReadonlySet<ID>;
}

export function matchesFilters(material: Material, filters: ResourceFilters, context: FilterContext): boolean {
  if (filters.skills.length > 0 && !material.skillIds.some((id) => filters.skills.includes(id))) return false;
  if (!matchesAny(filters.types, material.type)) return false;
  if (!matchesAny(filters.levels, material.level)) return false;
  if (!matchesAny(filters.costs, material.cost)) return false;
  if (!matchesAny(filters.lengths, lengthBucketOf(material.estimatedHours))) return false;

  const inLibrary = context.libraryIds.has(material.id);
  if (filters.show === "saved" && !inLibrary) return false;
  if (filters.show === "not-saved" && inLibrary) return false;

  const terms = searchTerms(filters.query);
  if (terms.length > 0) {
    const text = searchableText(material);
    if (!terms.every((term) => text.includes(term))) return false;
  }
  return true;
}

/** Unknown lengths sort last in both directions; ties keep the curated order. */
const byHours = (direction: 1 | -1) => (a: Material, b: Material) => {
  if (a.estimatedHours === undefined || b.estimatedHours === undefined) {
    return Number(a.estimatedHours === undefined) - Number(b.estimatedHours === undefined);
  }
  return (a.estimatedHours - b.estimatedHours) * direction;
};

const titleCollator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Returns a sorted copy. "recommended" keeps the input (curated) order. */
export function sortMaterials(materials: readonly Material[], sort: SortOption): Material[] {
  const sorted = [...materials];
  if (sort === "shortest") sorted.sort(byHours(1));
  if (sort === "longest") sorted.sort(byHours(-1));
  if (sort === "title") sorted.sort((a, b) => titleCollator.compare(a.title, b.title));
  return sorted;
}

export function applyFilters(
  materials: readonly Material[],
  filters: ResourceFilters,
  context: FilterContext,
): Material[] {
  return sortMaterials(
    materials.filter((material) => matchesFilters(material, filters, context)),
    filters.sort,
  );
}

/** True when anything narrows the list (sorting doesn't count). */
export function hasActiveFilters(filters: ResourceFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.skills.length > 0 ||
    filters.types.length > 0 ||
    filters.levels.length > 0 ||
    filters.costs.length > 0 ||
    filters.lengths.length > 0 ||
    filters.show !== "all"
  );
}

/** Resets every filter but keeps the chosen sort order. */
export const clearFilters = (filters: ResourceFilters): ResourceFilters => ({ ...DEFAULT_FILTERS, sort: filters.sort });

/** Adds or removes one option of a multi-select category. */
export function toggleOption(filters: ResourceFilters, category: FilterCategory, value: string): ResourceFilters {
  const current = filters[category] as readonly string[];
  const next = current.includes(value) ? current.filter((option) => option !== value) : [...current, value];
  return { ...filters, [category]: next };
}
