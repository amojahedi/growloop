"use client";

import { useCallback } from "react";
import { useActions } from "./hooks";
import type { ValidationResult } from "./schema";
import { exportFileName } from "./serialization";
import type { AppData } from "@/lib/domain/types";

/** Browser-side export (file download) and import (file read) of the workspace. */
export function useDataTransfer() {
  const { exportData, importData } = useActions();

  const downloadExport = useCallback(() => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: exportFileName() });
    link.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  const importFile = useCallback(
    async (file: File): Promise<ValidationResult<AppData>> => importData(await file.text()),
    [importData],
  );

  return { downloadExport, importFile };
}
