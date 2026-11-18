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
}: {
  state: PlannerV2;
  onRestore: (state: PlannerSession) => void;
  startup: StartupSession;
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
    <section
      className="cash-panel prose planner-backup"
      aria-labelledby="backup-heading"
    >
      <h2 id="backup-heading">Back up your plan</h2>
      <p>
        Download a JSON backup to move your plan to another browser or restore
        it later. The file contains your financial inputs; keep it private.
      </p>
      <div className="button-row">
        <Button variant="outline" size="sm" onClick={download}>
          <Download aria-hidden="true" />
          Download backup
        </Button>
        <Button
          ref={restoreButton}
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden="true" />
          Restore backup
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
      <p role="status">{message}</p>
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
