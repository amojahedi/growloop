import {
  DEFAULT_FILTERS,
  FILTER_COSTS,
  FILTER_LEVELS,
  FILTER_TYPES,
  LENGTH_BUCKETS,
  SHOW_OPTIONS,
  SORT_OPTIONS,
  type ResourceFilters,
} from "./resource-filters";

/**
 * Filter state ⇄ URL query string, so a filtered view is shareable, survives a
 * refresh and works with the back button. Lists are comma-separated
 * (`?skill=roadmapping,prioritization&type=book`); defaults are omitted, so
 * the unfiltered page has a clean URL. Parsing never throws: unknown values
 * are dropped and the rest is kept.
 */

const MAX_QUERY_LENGTH = 200;
const MAX_LIST_ITEMS = 50;

/** Query-string keys, short and readable. */
const KEYS = {
  query: "q",
  skills: "skill",
  types: "type",
  levels: "level",
  costs: "cost",
  lengths: "length",
  show: "show",
  sort: "sort",
} as const satisfies Record<keyof ResourceFilters, string>;

/** Read-only view of URLSearchParams (what Next's `useSearchParams()` returns). */
type ParamsLike = Pick<URLSearchParams, "get">;

function readList(params: ParamsLike, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values)].slice(0, MAX_LIST_ITEMS);
}

function readEnumList<T extends string>(params: ParamsLike, key: string, allowed: readonly T[]): T[] {
  return readList(params, key).filter((value): value is T => (allowed as readonly string[]).includes(value));
}

function readEnum<T extends string>(params: ParamsLike, key: string, allowed: readonly T[], fallback: T): T {
  const value = params.get(key);
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Parses filters from a query string. `knownSkillIds`, when given, drops skill
 * ids that don't exist (e.g. a link shared from a workspace with custom skills).
 */
export function parseFilters(params: ParamsLike, knownSkillIds?: ReadonlySet<string>): ResourceFilters {
  const skills = readList(params, KEYS.skills);
  return {
    query: (params.get(KEYS.query) ?? "").slice(0, MAX_QUERY_LENGTH),
    skills: knownSkillIds ? skills.filter((id) => knownSkillIds.has(id)) : skills,
    types: readEnumList(params, KEYS.types, FILTER_TYPES),
    levels: readEnumList(params, KEYS.levels, FILTER_LEVELS),
    costs: readEnumList(params, KEYS.costs, FILTER_COSTS),
    lengths: readEnumList(params, KEYS.lengths, LENGTH_BUCKETS),
    show: readEnum(params, KEYS.show, SHOW_OPTIONS, DEFAULT_FILTERS.show),
    sort: readEnum(params, KEYS.sort, SORT_OPTIONS, DEFAULT_FILTERS.sort),
  };
}

/** Serializes filters to a query string without the leading "?" ("" when everything is default). */
export function serializeFilters(filters: ResourceFilters): string {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query) params.set(KEYS.query, query);

  const lists = [
    [KEYS.skills, filters.skills],
    [KEYS.types, filters.types],
    [KEYS.levels, filters.levels],
    [KEYS.costs, filters.costs],
    [KEYS.lengths, filters.lengths],
  ] as const;
  for (const [key, values] of lists) {
    if (values.length > 0) params.set(key, values.join(","));
  }

  if (filters.show !== DEFAULT_FILTERS.show) params.set(KEYS.show, filters.show);
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set(KEYS.sort, filters.sort);
  // Commas are safe in a query string; keep them readable instead of "%2C".
  return params.toString().replaceAll("%2C", ",");
}
