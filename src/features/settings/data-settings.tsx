"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissToast, toast } from "@/components/ui/toast";
import { isSampleModeOn, useSampleMode } from "@/lib/store/device";
import { useActions } from "@/lib/store/hooks";
import { useDataTransfer } from "@/lib/store/use-data-transfer";

/**
 * Settings → Your data (settings-and-ai-keys.md §Your data, ST-4): export,
 * import with a replace dialog, sample data, erase everything. Whole-workspace
 * actions use proper dialogs; nothing here uses window.confirm.
 */
export function DataSettings() {
  const router = useRouter();
  const { enterSampleMode, exitSampleMode, eraseEverything } = useActions();
  const sampleMode = useSampleMode();
  const { downloadExport, prepareImport, applyImport } = useDataTransfer();
  const fileInput = useRef<HTMLInputElement>(null);
  const importHintId = useId();
  const [importError, setImportError] = useState<string>();
  const [pendingImport, setPendingImport] = useState<{ json: string } | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);

  // Sample mode switched (here, from the banner or in another tab): a pending
  // import or erase was asked about another workspace, so close those dialogs.
  const [seenSampleMode, setSeenSampleMode] = useState(sampleMode);
  if (seenSampleMode !== sampleMode) {
    setSeenSampleMode(sampleMode);
    setPendingImport(null);
    setEraseOpen(false);
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(undefined);
    const prepared = await prepareImport(file);
    if (prepared.ok) setPendingImport({ json: prepared.json });
    else setImportError(prepared.error);
  };

  const replace = () => {
    if (!pendingImport) return;
    setPendingImport(null);
    // Checked again at apply time: imports never land in the sample workspace.
    if (isSampleModeOn()) return;
    const result = applyImport(pendingImport.json);
    if (result.ok) toast({ message: "Import complete." });
    else setImportError(result.error);
  };

  const trySample = () => {
    if (!enterSampleMode()) {
      toast({ message: "Couldn't load the sample. Try again." });
      return;
    }
    // An Undo toast from the workspace that was just swapped out must not act on this one.
    dismissToast();
    router.push("/");
  };

  const leaveSample = () => {
    const { ownWorkspaceEmpty } = exitSampleMode();
    toast({ message: ownWorkspaceEmpty ? "Fresh start. It's all yours." : "Back to your own data." });
    router.push("/");
  };

  const erase = () => {
    eraseEverything();
    dismissToast();
    setEraseOpen(false);
    // The first-launch screen shows again on the Dashboard.
    router.push("/");
  };

  return (
    <Section title="Your data" description="Everything is stored in this browser. Nothing is sent anywhere unless you use Claude.">
      <div className="flex flex-col divide-y text-sm">
        <div className="flex flex-col gap-2 pb-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadExport}>
              <DownloadIcon aria-hidden />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={sampleMode}
              aria-describedby={sampleMode ? importHintId : undefined}
              onClick={() => fileInput.current?.click()}
            >
              <UploadIcon aria-hidden />
              Import…
            </Button>
          </div>
          {sampleMode && (
            <p id={importHintId} className="text-muted-foreground">
              Leave sample data to import.
            </p>
          )}
          {importError && (
            <p role="alert" className="text-destructive">
              Couldn&apos;t import that file. {importError}
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
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
          {sampleMode ? (
            <Button variant="outline" size="sm" onClick={leaveSample}>
              Back to my data
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={trySample}>
                Try sample data
              </Button>
              <p className="text-muted-foreground">Your own data stays safe and comes back when you exit.</p>
            </>
          )}
        </div>

        {!sampleMode && (
          <div className="pt-4">
            <Button variant="destructive" size="sm" onClick={() => setEraseOpen(true)}>
              Erase everything
            </Button>
          </div>
        )}
      </div>

      <Dialog open={pendingImport !== null} onOpenChange={(open) => !open && setPendingImport(null)}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Replace everything with this file?</DialogTitle>
            <DialogDescription>
              Your current plans, notes and objectives will be replaced. Export first if you might want them back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={replace}>
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eraseOpen} onOpenChange={setEraseOpen}>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Erase everything on this device?</DialogTitle>
            <DialogDescription>
              This deletes your plans, notes, objectives, settings and saved Claude key from this browser. It can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={erase}>
              Erase everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
