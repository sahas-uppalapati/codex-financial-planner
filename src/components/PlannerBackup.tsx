import { useRef, useState } from "react";
import type { PlannerV2 } from "../lib/planner";
import { exportPlannerBackup, importPlannerBackup, MAX_BACKUP_BYTES } from "../lib/plannerBackup";
import { downloadText } from "../lib/csv";

export function PlannerBackup({ state, onRestore }: { state: PlannerV2; onRestore: (state: PlannerV2) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  function download() {
    try {
      downloadText(exportPlannerBackup(state), "careerworth-plan.json", "application/json");
      setMessage("Backup downloaded. Store it somewhere private.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not export this plan.");
    }
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup is too large. Your current plan was not changed.");
      const restored = importPlannerBackup(await file.text());
      if (!window.confirm("Restore this backup? It will replace the current plan in this browser.")) {
        setMessage("Restore canceled. Your current plan was not changed.");
        return;
      }
      onRestore(restored);
      setMessage("Backup restored. Check your assumptions and results.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this backup. Your current plan was not changed.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="cash-panel prose" aria-labelledby="backup-heading">
      <h2 id="backup-heading">Back up your plan</h2>
      <p>Download a JSON backup to move your plan to another browser or restore it later. The file contains your financial inputs; keep it private.</p>
      <button type="button" className="secondary" onClick={download}>Download backup</button>{" "}
      <button type="button" className="secondary" onClick={() => input.current?.click()}>Restore backup</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => { void restore(event.target.files?.[0]); }} />
      <p role="status">{message}</p>
    </section>
  );
}
