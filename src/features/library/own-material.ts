import type { MaterialDraft } from "@/lib/ai/schemas";
import type { NewMaterial } from "@/lib/domain/app-data";
import type { ID, Material, MaterialCost, MaterialLevel, MaterialType } from "@/lib/domain/types";

/**
 * Pure helpers for "Add your own" (ML-2, flow d): read what the user pasted,
 * pre-fill the review form (from Claude's draft or from the paste alone), spot
 * duplicates, and turn the form into a new custom material.
 */

/** One item per paste: only the first non-empty line counts. */
export function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

/** The pasted text as an http(s) URL, or undefined when it isn't one. Accepts "www.example.com/…". */
export function asUrl(text: string): string | undefined {
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  if (/\s/.test(candidate)) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const DOMAIN_TYPES: [RegExp, MaterialType][] = [
  [/(^|\.)(coursera\.org|udemy\.com|edx\.org|reforge\.com|maven\.com)$/, "course"],
  [/(^|\.)(podcasts\.apple\.com|open\.spotify\.com|overcast\.fm|pca\.st)$/, "podcast"],
  [/(^|\.)(goodreads\.com|amazon\.[a-z.]+|oreilly\.com|manning\.com)$/, "book"],
  [/(^|\.)(medium\.com|substack\.com|hbr\.org|svpg\.com)$/, "article"],
];

/** A best guess at the type from a link's domain; "custom" when unknown. */
export function guessTypeFromUrl(url: string): MaterialType {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return DOMAIN_TYPES.find(([pattern]) => pattern.test(host))?.[1] ?? "custom";
}

export interface OwnMaterialForm {
  title: string;
  type: MaterialType;
  author: string;
  url: string;
  tagline: string;
  summary: string;
  skillIds: ID[];
  /** Kept as text while editing; parsed on save. */
  hours: string;
  level: MaterialLevel;
  cost: MaterialCost;
}

/** Fields Claude filled, so the form can mark them for review. */
export type FilledField = keyof OwnMaterialForm;

const EMPTY_FORM: OwnMaterialForm = {
  title: "",
  type: "custom",
  author: "",
  url: "",
  tagline: "",
  summary: "",
  skillIds: [],
  hours: "",
  level: "beginner",
  cost: "free",
};

/**
 * The review form's starting values. Without a draft: a link goes to the URL
 * field (with a type guessed from its domain), anything else becomes the title.
 * With a draft, Claude's values fill in; a pasted link always wins over a URL
 * the model suggested.
 */
export function initialForm(pasted: string, draft?: MaterialDraft): { form: OwnMaterialForm; filled: Set<FilledField> } {
  const text = firstLine(pasted);
  const url = asUrl(text);
  const base: OwnMaterialForm = url
    ? { ...EMPTY_FORM, url, type: guessTypeFromUrl(url) }
    : { ...EMPTY_FORM, title: text };
  const filled = new Set<FilledField>();
  if (!draft) return { form: base, filled };

  const form = { ...base };
  const take = <K extends FilledField>(key: K, value: OwnMaterialForm[K] | undefined, isSet: boolean) => {
    if (value === undefined || !isSet) return;
    form[key] = value;
    filled.add(key);
  };
  take("title", draft.title, draft.title !== "");
  take("type", draft.type, draft.type !== "custom");
  take("author", draft.author, draft.author !== "");
  take("url", draft.url, !url && draft.url !== undefined);
  take("tagline", draft.tagline, draft.tagline !== "");
  take("summary", draft.summary, draft.summary !== "");
  take("skillIds", draft.skillIds, draft.skillIds.length > 0);
  take("hours", draft.estimatedHours === undefined ? undefined : String(draft.estimatedHours), true);
  take("level", draft.level, true);
  take("cost", draft.cost, true);
  return { form, filled };
}

export interface FormProblems {
  title?: string;
  skillIds?: string;
  url?: string;
  hours?: string;
}

/** Required: a title and at least one skill. URL and hours must be valid when given. */
export function validateForm(form: OwnMaterialForm): FormProblems {
  const problems: FormProblems = {};
  if (!form.title.trim()) problems.title = "Add a title.";
  if (form.skillIds.length === 0) problems.skillIds = "Pick at least one skill.";
  if (form.url.trim() && !asUrl(form.url.trim())) problems.url = "Enter a full link, starting with https://.";
  const hours = form.hours.trim();
  if (hours && !(Number(hours) > 0 && Number(hours) <= 1000)) problems.hours = "Enter hours between 0 and 1,000.";
  return problems;
}

export function toNewMaterial(form: OwnMaterialForm): NewMaterial {
  const hours = Number(form.hours.trim());
  const url = form.url.trim() ? asUrl(form.url.trim()) : undefined;
  return {
    title: form.title.trim(),
    type: form.type,
    skillIds: form.skillIds,
    author: form.author.trim(),
    tagline: form.tagline.trim(),
    summary: form.summary.trim(),
    level: form.level,
    cost: form.cost,
    ...(url ? { url } : {}),
    ...(form.hours.trim() && hours > 0 ? { estimatedHours: hours } : {}),
  };
}

const comparable = (text: string) => text.trim().toLowerCase().replace(/\/+$/, "");

/** A material the paste already refers to: same link, or same title (case-insensitive). */
export function findExisting(pasted: string, materials: readonly Material[]): Material | undefined {
  const text = firstLine(pasted);
  if (!text) return undefined;
  const url = asUrl(text);
  return materials.find((material) =>
    url
      ? material.url !== undefined && comparable(material.url) === comparable(url)
      : comparable(material.title) === comparable(text),
  );
}
