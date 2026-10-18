"use client";

import { useCallback } from "react";
import { isSampleModeOn } from "./device";
import { useActions } from "./hooks";
import type { ValidationResult } from "./schema";
import { exportFileName, parseImportedData } from "./serialization";
import type { Workspace } from "@/lib/domain/types";

/** A file read for import and checked, but not applied yet (the user confirms first). */
export type PreparedImport = { ok: true; json: string; fileName: string } | { ok: false; error: string };

/**
 * Browser-side export (file download) and import (file read) of the workspace.
 * Import is two steps so the replace dialog only appears for a usable file:
 * `prepareImport` reads and checks it, `applyImport` replaces the workspace.
 */
export function useDataTransfer() {
  const { exportData, importData } = useActions();

  const downloadExport = useCallback(() => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: exportFileName(new Date(), { sample: isSampleModeOn() }) });
    link.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  const prepareImport = useCallback(async (file: File): Promise<PreparedImport> => {
    let json: string;
    try {
      json = await file.text();
    } catch {
      return { ok: false, error: "The file couldn't be read." };
    }
    const result = parseImportedData(json);
    return result.ok ? { ok: true, json, fileName: file.name } : { ok: false, error: result.error };
  }, []);

  const applyImport = useCallback((json: string): ValidationResult<Workspace> => importData(json), [importData]);

  return { downloadExport, prepareImport, applyImport };
}
