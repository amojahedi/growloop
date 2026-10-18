"use client";

import { LibraryIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSkill } from "@/lib/store/hooks";
import { useUIStore } from "@/lib/store/ui-store";

/**
 * The skill sheet (skills.md), opened from anywhere with
 * `useUIStore.getState().openSkillSheet(skillId)`. Mounted once in the app
 * shell. WP0 stub: header and Browse resources; WP5 fills in level, this
 * year's KRs, cards and notes.
 */
export function SkillSheet() {
  const skillId = useUIStore((state) => state.skillSheet);
  const closeSkillSheet = useUIStore((state) => state.closeSkillSheet);
  const skill = useSkill(skillId ?? "");

  useEffect(() => {
    if (skillId && !skill) {
      console.warn(`[growloop] No skill with id "${skillId}"; the skill sheet stays closed.`);
      closeSkillSheet();
    }
  }, [skillId, skill, closeSkillSheet]);

  return (
    <Sheet open={Boolean(skill)} onOpenChange={(open) => !open && closeSkillSheet()}>
      {skill && (
        <SheetContent size="skill">
          <SheetHeader>
            <SheetTitle>{skill.name}</SheetTitle>
            <SheetDescription>{skill.description || "A skill you added."}</SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button asChild size="sm">
              <Link href={`/library?skill=${encodeURIComponent(skill.id)}`} onClick={closeSkillSheet}>
                <LibraryIcon aria-hidden />
                Browse resources
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      )}
    </Sheet>
  );
}
