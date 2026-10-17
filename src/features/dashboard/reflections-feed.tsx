"use client";

import { EmptyHint, Section } from "@/components/app/section";
import { latestReflections } from "@/lib/domain/dashboard";
import { formatShortDate } from "@/lib/format";
import { useMaterialMap, usePlanItems } from "@/lib/store/hooks";

/** Latest summaries and notes (D-6). */
export function ReflectionsFeed() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const reflections = latestReflections(items, 5);

  return (
    <Section title="Latest summaries & notes">
      {reflections.length === 0 ? (
        <EmptyHint>Summaries you write in your own words will show up here.</EmptyHint>
      ) : (
        <ul className="flex flex-col gap-3">
          {reflections.map((reflection) => (
            <li key={`${reflection.itemId}-${reflection.kind}`} className="text-sm">
              <p className="font-medium">
                {materials.get(reflection.materialId)?.title ?? "Unknown material"}{" "}
                <span className="font-normal text-muted-foreground">
                  · {reflection.kind} · {formatShortDate(reflection.updatedAt)}
                </span>
              </p>
              <p className="line-clamp-2 text-muted-foreground">{reflection.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
