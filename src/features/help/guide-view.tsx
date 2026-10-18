import { ArrowRightIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import type { Guide } from "@/content/help/guide";
import { TakeTourButton } from "./take-tour-button";

/** Splits "**bold** text" into plain and bold runs; nothing else in guide copy is interpreted. */
export function parseEmphasis(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) => (part.startsWith("**") && part.endsWith("**") ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }));
}

function Paragraph({ text }: { text: string }) {
  return (
    <p>
      {parseEmphasis(text).map((run, index) =>
        run.bold ? (
          <strong key={index} className="font-semibold text-foreground">
            {run.text}
          </strong>
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}
    </p>
  );
}

const linkClass =
  "inline-flex items-center gap-1 rounded-sm font-semibold text-brand-soft-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden";

/** "How Growloop works" (help-and-guide.md §Guide page): one readable column, sections from data. */
export function GuideView({ guide }: { guide: Guide }) {
  return (
    <article className="mx-auto flex w-full max-w-[680px] flex-col gap-10 pb-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">{guide.title}</h1>
        <p className="text-base text-muted-foreground">{guide.intro}</p>
      </header>

      <section aria-labelledby={guide.loop.id} className="flex flex-col gap-3">
        <h2 id={guide.loop.id} className="font-display text-xl font-semibold tracking-tight">
          1. {guide.loop.heading}
        </h2>
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {guide.loop.steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-1">
              <Link
                href={step.href}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden motion-reduce:transition-none"
              >
                {step.label}
              </Link>
              {index < guide.loop.steps.length - 1 && <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{guide.loop.caption}</p>
      </section>

      {guide.sections.map((section, index) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="flex flex-col gap-3">
          <h2 id={`${section.id}-heading`} className="font-display text-xl font-semibold tracking-tight">
            {index + 2}. {section.heading}
          </h2>
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-muted-foreground">
            {section.paragraphs.map((text) => (
              <Paragraph key={text} text={text} />
            ))}
          </div>
          {section.link && (
            <p>
              <Link href={section.link.href} className={linkClass}>
                {section.link.label}
                <ArrowRightIcon className="size-4" aria-hidden />
              </Link>
            </p>
          )}
        </section>
      ))}

      <footer className="border-t border-border pt-6">
        <TakeTourButton label={guide.tourButton} />
      </footer>
    </article>
  );
}
