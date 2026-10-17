"use client";

import { useRef, useState } from "react";
import { DataGate } from "@/components/app/data-gate";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/store/hooks";
import { useDataTransfer } from "@/lib/store/use-data-transfer";

export function SettingsView() {
  return (
    <DataGate>
      <DataSettings />
    </DataGate>
  );
}

/** Export / import / reset. Data never leaves this browser unless exported. */
function DataSettings() {
  const { resetToDemo, resetToEmpty } = useActions();
  const { downloadExport, importFile } = useDataTransfer();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();

  const onFile = async (file: File | undefined) => {
    if (!file || !window.confirm("Importing replaces all current data. Continue?")) return;
    const result = await importFile(file);
    setMessage(result.ok ? "Import complete." : `Import failed: ${result.error}`);
  };

  return (
    <Section title="Your data" description="Everything is stored locally in this browser.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadExport}>
          Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          Import JSON…
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.confirm("Replace all data with the sample workspace?") && resetToDemo()}
        >
          Load sample data
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => window.confirm("Delete all plans, notes and objectives? This cannot be undone.") && resetToEmpty()}
        >
          Start fresh
        </Button>
      </div>
      {message && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </Section>
  );
}
