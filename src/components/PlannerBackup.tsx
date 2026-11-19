import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { PlannerV2 } from "../lib/planner";
import type { StartupSession } from "../lib/startupComparison";
import type { PlannerSession } from "../lib/plannerBackup";
import {
  exportPlannerBackup,
  importPlannerBackup,
  MAX_BACKUP_BYTES,
} from "../lib/plannerBackup";
import { downloadText } from "../lib/csv";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

export function PlannerBackup({
  state,
  onRestore,
  startup,
  compact = false,
}: {
  state: PlannerV2;
  onRestore: (state: PlannerSession) => void;
  startup: StartupSession;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const restoreButton = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<PlannerSession | null>(null);

  function download() {
    try {
      downloadText(
        exportPlannerBackup(state, startup),
        "careerworth-plan.json",
        "application/json",
      );
      setMessage("Backup downloaded. Store it somewhere private.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not export this plan.",
      );
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error(
          "Backup is too large. Your current plan was not changed.",
        );
      setPending(importPlannerBackup(await file.text()));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not read this backup. Your current plan was not changed.",
      );
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function cancel() {
    setPending(null);
    setMessage("Restore canceled. Your current plan was not changed.");
  }

  return (
    <section className={`cash-panel prose planner-backup${compact ? " planner-backup-compact" : ""}`} aria-label="Plan backup">
      {!compact && <><h2>Back up your plan</h2><p>Download a JSON backup to move your plan to another browser or restore it later. The file contains your financial inputs; keep it private.</p></>}
      <div className="button-row">
        <Button variant="outline" size="sm" aria-label={compact ? "Download backup" : undefined} onClick={download}>
          <Download aria-hidden="true" />
          {compact ? "Backup" : "Download backup"}
        </Button>
        <Button
          ref={restoreButton}
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden="true" />
          {compact ? "Restore" : "Restore backup"}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          void restore(event.target.files?.[0]);
        }}
      />
      <p className={compact ? "backup-status" : undefined} role="status">{message}</p>
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreButton.current?.focus();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById("cancel-restore")?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              This will replace the current plan and startup details in this browser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button id="cancel-restore" variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pending) return;
                onRestore(pending);
                setPending(null);
                setMessage(
                  "Backup restored. Check your assumptions and results.",
                );
              }}
            >
              Restore plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
