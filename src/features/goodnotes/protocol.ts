/* Goodnotes-Tool – Protokoll zwischen App und Engine-WebView.
 * Web-Quelle: tools/goodnotes/goodnotes.js (Export-Ablauf, Auswahlwerte), tools/goodnotes/ink-engine.js (safeName, PAPERS), Web-Commit 770dbe4.
 * Die Engine selbst läuft unverändert in engine/ (siehe docs/THIRD-PARTY.md). */

export type OutputMode = "ink" | "pdf";
export type PaperId = "lined" | "lined-small" | "grid" | "blank";
export const FONTS = ["Caveat", "Kalam", "Patrick Hand", "Indie Flower", "Shadows Into Light", "Gochi Hand"] as const;
export type FontId = (typeof FONTS)[number];
export const INKS = [
  { id: "#1d3f9e", label: "Blau" }, { id: "#262626", label: "Schwarz" },
  { id: "#0f6b4f", label: "Grün" }, { id: "#9b1c31", label: "Rot" },
] as const;
export const PAPERS: ReadonlyArray<{ id: PaperId; label: string }> = [
  { id: "lined", label: "Liniert" }, { id: "lined-small", label: "Eng liniert" },
  { id: "grid", label: "Kariert" }, { id: "blank", label: "Blanko" },
];

export interface InkSettings {
  mode: OutputMode;
  font: FontId;
  paper: PaperId;
  ink: string;
  weight: number;
  size: number;
  jitter: number;
}
export const DEFAULT_SETTINGS: InkSettings = { mode: "ink", font: "Caveat", paper: "lined", ink: "#1d3f9e", weight: 1, size: 1, jitter: 1 };

/** App → WebView */
export type HostRequest =
  | { type: "render"; id: string; text: string; settings: InkSettings }
  | { type: "export-pdf"; id: string }
  | { type: "export-goodnotes"; id: string }
  | { type: "template"; id: string; name: string; base64: string }
  | { type: "clear-template"; id: string };

/** WebView → App */
export type HostMessage =
  | { type: "ready" }
  | { type: "rendered"; id: string; pages: string[] }
  | { type: "exported"; id: string; kind: "pdf" | "goodnotes"; files: string[] }
  | { type: "template-ok"; id: string; pageSize: [number, number]; hasInk: boolean }
  | { type: "template-cleared"; id: string }
  | { type: "error"; id: string; message: string };

const isStr = (v: unknown): v is string => typeof v === "string";

/** Liest eine Nachricht der WebView. Unbekanntes oder Kaputtes ergibt null (nie eine Ausnahme). */
export function parseHostMessage(raw: unknown): HostMessage | null {
  let m: any;
  try { m = typeof raw === "string" ? JSON.parse(raw) : null; } catch (_) { return null; }
  if (!m || typeof m !== "object") return null;
  switch (m.type) {
    case "ready": return { type: "ready" };
    case "rendered": return isStr(m.id) && Array.isArray(m.pages) && m.pages.every(isStr) ? { type: "rendered", id: m.id, pages: m.pages } : null;
    case "exported": return isStr(m.id) && (m.kind === "pdf" || m.kind === "goodnotes") && Array.isArray(m.files) && m.files.length > 0 && m.files.every(isStr)
      ? { type: "exported", id: m.id, kind: m.kind, files: m.files } : null;
    case "template-ok": return isStr(m.id) && Array.isArray(m.pageSize) && m.pageSize.length === 2 && m.pageSize.every((n: unknown) => typeof n === "number")
      ? { type: "template-ok", id: m.id, pageSize: [m.pageSize[0], m.pageSize[1]], hasInk: !!m.hasInk } : null;
    case "template-cleared": return isStr(m.id) ? { type: "template-cleared", id: m.id } : null;
    case "error": return isStr(m.id) ? { type: "error", id: m.id, message: isStr(m.message) && m.message ? m.message : "Unbekannter Fehler." } : null;
    default: return null;
  }
}

/** Dateiname ohne Zeichen, die iOS/Goodnotes nicht mögen (wie ink-engine.js safeName). */
export const safeName = (s: string | null | undefined): string => (s || "Notiz").trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "Notiz";

/** Dateinamen eines Exports: bei mehreren .goodnotes-Dateien (eine je Seite) mit " (n)", wie im Web. Ein PDF ist immer eine Datei. */
export function exportFileNames(base: string, kind: "pdf" | "goodnotes", count: number): string[] {
  const name = safeName(base), ext = kind === "pdf" ? "pdf" : "goodnotes";
  const n = kind === "pdf" ? 1 : count;
  return Array.from({ length: n }, (_, i) => `${name}${n > 1 ? ` (${i + 1})` : ""}.${ext}`);
}

/** Seitenzahl-Text der Vorschau: "1 Seite" / "n Seiten". */
export const pageCountLabel = (n: number): string => `${n} Seite${n === 1 ? "" : "n"}`;

/** Fortlaufende Anfrage-IDs. */
export function createIdGenerator(prefix = "r"): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

/** Hinweis nach dem Export (Web: Rückgabewert von exportGoodnotes). */
export const exportHint = (kind: "pdf" | "goodnotes", count: number): string =>
  kind === "pdf" ? "PDF bereit zum Teilen." : count > 1 ? `${count} Dateien` : "Jetzt in Goodnotes öffnen";
