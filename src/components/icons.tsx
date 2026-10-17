import {
  AwardIcon,
  BookOpenIcon,
  ChartLineIcon,
  CodeIcon,
  CompassIcon,
  CrownIcon,
  FlaskConicalIcon,
  GraduationCapIcon,
  HeadphonesIcon,
  LinkIcon,
  ListOrderedIcon,
  MapIcon,
  MessageSquareIcon,
  NewspaperIcon,
  PaletteIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { MaterialType } from "@/lib/domain/types";

/**
 * Skill icons are stored as kebab-case Lucide names (e.g. "chart-line"). An
 * explicit lookup keeps the bundle small; unknown names fall back to a sparkle.
 * Add an entry here when a new icon becomes available in the skill editor.
 */
export const SKILL_ICONS: Readonly<Record<string, LucideIcon>> = {
  "chart-line": ChartLineIcon,
  code: CodeIcon,
  compass: CompassIcon,
  crown: CrownIcon,
  "flask-conical": FlaskConicalIcon,
  "list-ordered": ListOrderedIcon,
  map: MapIcon,
  "message-square": MessageSquareIcon,
  palette: PaletteIcon,
  rocket: RocketIcon,
  search: SearchIcon,
  sparkles: SparklesIcon,
  users: UsersIcon,
};

export function SkillIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = SKILL_ICONS[name] ?? SparklesIcon;
  return <Icon aria-hidden {...props} />;
}

export const MATERIAL_TYPE_ICONS: Readonly<Record<MaterialType, LucideIcon>> = {
  course: GraduationCapIcon,
  certification: AwardIcon,
  book: BookOpenIcon,
  article: NewspaperIcon,
  podcast: HeadphonesIcon,
  custom: LinkIcon,
};

export function MaterialTypeIcon({ type, ...props }: { type: MaterialType } & LucideProps) {
  const Icon = MATERIAL_TYPE_ICONS[type];
  return <Icon aria-hidden {...props} />;
}
