"use client";

import { useRef, useState } from "react";
import { DataGate } from "@/components/app/data-gate";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useSampleMode } from "@/lib/store/device";
import { useActions } from "@/lib/store/hooks";
import { useDataTransfer } from "@/lib/store/use-data-transfer";
import { SkillsView } from "../skills/skills-view";
import { ClaudeSettings } from "./claude-settings";

export function SettingsView() {
  return (
    <div className="flex flex-col gap-6">
      {/* The old Skills page, here until Settings > Skills replaces it; /skills redirects to this anchor. */}
      <div id="skills" className="scroll-mt-6">
        <DataGate>
          <SkillsView />
        </DataGate>
      </div>
      {/* Independent of workspace data: the key is stored separately. */}
      <ClaudeSettings />
      <DataGate>
        <DataSettings />
      </DataGate>
    </div>
  );
}

/** Export / import / sample data / erase. Data never leaves this browser unless exported. */
function DataSettings() {
  const { enterSampleMode, exitSampleMode, eraseEverything } = useActions();
  const sampleMode = useSampleMode();
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
        <Button variant="outline" size="sm" disabled={sampleMode} onClick={() => fileInput.current?.click()}>
          Import JSON…
        </Button>
        {sampleMode ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const { ownWorkspaceEmpty } = exitSampleMode();
              toast({ message: ownWorkspaceEmpty ? "Fresh start. It's all yours." : "Back to your own data." });
            }}
          >
            Back to my data
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!enterSampleMode()) toast({ message: "Couldn't load the sample. Try again." });
            }}
          >
            Try sample data
          </Button>
        )}
        {!sampleMode && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() =>
              window.confirm(
                "Erase everything on this device? This deletes your plans, notes, objectives, settings and saved Claude key from this browser. It can't be undone.",
              ) && eraseEverything()
            }
          >
            Erase everything
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {sampleMode ? "Leave sample data to import." : "Your own data stays safe and comes back when you exit sample data."}
      </p>
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
