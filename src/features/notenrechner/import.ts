/* Notenrechner – Gast-Daten ins Konto übernehmen (sicher wiederholbar). Web-Quelle: importGuestData in tools/notenrechner/store.js
 * (Pensum, Web-Commit 770dbe4). Unterschied: Der Plan richtet sich nach dem aktuellen Stand im Konto (planGuestImport), alle Schreibvorgänge
 * werden mit flushOrThrow() bestätigt; bei einem Fehler bleibt alles Laufende zu Ende und der Fehler wird weitergereicht.
 * Die Gastdaten löscht erst der Aufrufer, nachdem diese Funktion ohne Fehler zurückgekehrt ist. */
import type { CloudStore, NotenData } from "./store";
import { planGuestImport } from "./ui-model";

export interface GuestImportResult { subjects: number; grades: number; merged: number; skipped: number }

export async function importGuestSafe(cloud: CloudStore, guest: NotenData): Promise<GuestImportResult> {
  const created: string[] = [];
  try {
    const plan = planGuestImport(guest, await cloud.load(), () => cloud.newId());
    for (const s of plan.subjects) { created.push(s.id); await cloud.addSubject(s); }
    for (let i = 0; i < plan.grades.length; i += 5) {
      const batch = plan.grades.slice(i, i + 5);
      for (const g of batch) created.push(g.id);
      const results = await Promise.allSettled(batch.map((g) => cloud.addGrade(g)));
      const bad = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (bad) throw bad.reason;
    }
    await cloud.flushOrThrow();
    return { subjects: plan.subjects.length, grades: plan.grades.length, merged: plan.mergedSubjects, skipped: plan.skippedGrades };
  } catch (e) {
    // Laufende Schreibvorgänge zu Ende kommen lassen, damit eine Wiederholung den echten Stand im Konto sieht.
    await cloud.flush().catch(() => {});
    cloud.forgetFailures(created); // Ein neuer Versuch legt alles Fehlende unter neuen IDs an.
    throw e;
  }
}
