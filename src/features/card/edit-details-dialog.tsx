"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Material } from "@/lib/domain/types";
import { useActions, useSkills } from "@/lib/store/hooks";
import { toNewMaterial, validateForm, type FilledField, type OwnMaterialForm } from "../library/own-material";
import { OwnMaterialFields } from "../library/own-material-form";

const NOTHING_FILLED: ReadonlySet<FilledField> = new Set();

/** The Add-your-own form's values for a material the user already added. */
export function materialToForm(material: Material): OwnMaterialForm {
  return {
    title: material.title,
    type: material.type,
    author: material.author,
    url: material.url ?? "",
    tagline: material.tagline,
    summary: material.summary,
    skillIds: [...material.skillIds],
    hours: material.estimatedHours === undefined ? "" : String(material.estimatedHours),
    level: material.level,
    cost: material.cost,
  };
}

/** The changes to store: like a new material, but emptied link and length are cleared too. */
export function formToPatch(form: OwnMaterialForm) {
  const material = toNewMaterial(form);
  return { ...material, url: material.url, estimatedHours: material.estimatedHours };
}

/**
 * "Edit details" for the user's own material (card-detail.md §About): the
 * Add-your-own form in edit mode, reused from the Library. It edits the
 * material itself, so every card for it shows the new details.
 */
export function EditDetailsDialog({
  material,
  open,
  onOpenChange,
}: {
  material: Material;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so each opening starts from the saved details. */}
      <DialogContent className="sm:max-w-xl">
        <EditDetailsForm material={material} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EditDetailsForm({ material, onDone }: { material: Material; onDone: () => void }) {
  const { updateCustomMaterial } = useActions();
  const skills = useSkills();
  const [form, setForm] = useState(() => materialToForm(material));
  const [showProblems, setShowProblems] = useState(false);
  const problems = validateForm(form);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return;
    }
    updateCustomMaterial(material.id, formToPatch(form));
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Edit details</DialogTitle>
        <DialogDescription>Changes apply wherever this material appears.</DialogDescription>
      </DialogHeader>
      <OwnMaterialFields
        form={form}
        filled={NOTHING_FILLED}
        problems={showProblems ? problems : {}}
        skills={skills}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
      />
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
