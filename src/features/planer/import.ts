/* Planer – Gast-Einträge ins Konto übernehmen (Ablauf ohne Oberfläche, deshalb testbar).
 * Web-Quelle: tools/planer/planer.js (offerImport), Web-Commit 770dbe4. Anders als im Web wird der Gast-Speicher erst gelöscht,
 * wenn das Konto die Einträge bestätigt hat (flushOrThrow); bei einem Fehler bleiben sie lokal, und eine Wiederholung
 * überspringt, was schon im Konto liegt (planGuestImport). */
import type { PlanItem } from "./core";
import { planGuestImport } from "./model";
import type { CloudPlanStore, GuestPlanStore } from "./store";

export type ImportResult =
  | { status: "done"; taken: number; skipped: number }
  | { status: "nothing" }                     // alles schon im Konto: Gast-Daten wurden still gelöscht
  | { status: "no-room"; taken: number }      // Konto voll: Rest bleibt lokal
  | { status: "failed"; error: unknown };     // Konto hat nicht bestätigt: alles bleibt lokal

/**
 * `commit` setzt den neuen Stand in die Oberfläche und ruft cloud.save() auf (es muss die Liste an den Konto-Speicher geben).
 * Gast-Daten werden nur gelöscht, wenn alles Fehlende angenommen und gespeichert ist.
 */
export async function importGuestItems(args: {
  cloud: CloudPlanStore;
  guest: GuestPlanStore;
  current: readonly PlanItem[];
  local: readonly PlanItem[];
  commit: (items: PlanItem[]) => void;
}): Promise<ImportResult> {
  const { cloud, guest, current, local, commit } = args;
  const plan = planGuestImport(current, local, () => cloud.newId());
  if (plan.taken === 0 && plan.skipped === local.length) {
    await guest.clear(); // alles liegt schon im Konto
    return { status: "nothing" };
  }
  if (plan.taken === 0) return { status: "no-room", taken: 0 };
  commit(plan.items);
  try {
    await cloud.flushOrThrow();
  } catch (error) {
    return { status: "failed", error };
  }
  if (!plan.complete) return { status: "no-room", taken: plan.taken };
  await guest.clear();
  return { status: "done", taken: plan.taken, skipped: plan.skipped };
}
