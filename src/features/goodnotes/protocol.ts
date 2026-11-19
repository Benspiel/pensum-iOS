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

/** Kennung der eigenen Handschrift in der Engine (HAND_ID in ink-engine.js). */
export const HAND_FONT = "__hand__" as const;

export interface InkSettings {
  mode: OutputMode;
  font: FontId | typeof HAND_FONT;
  /** Verformung der eigenen Handschrift je Zeichen, 0 = aus (Web: handVary). */
  handVary: number;
  paper: PaperId;
  ink: string;
  weight: number;
  size: number;
  jitter: number;
}
export const DEFAULT_SETTINGS: InkSettings = { mode: "ink", font: "Caveat", paper: "lined", ink: "#1d3f9e", handVary: 0, weight: 1, size: 1, jitter: 1 };

/** App → WebView */
export type HostRequest =
  | { type: "render"; id: string; text: string; settings: InkSettings }
  | { type: "export-pdf" | "export-goodnotes"; id: string; text: string; settings: InkSettings }
  | { type: "template"; id: string; name: string; base64: string }
  | { type: "clear-template"; id: string }
  | { type: "set-hand"; id: string; packed: unknown | null };

/** WebView → App */
export type HostMessage =
  | { type: "ready" }
  | { type: "rendered"; id: string; pages: string[] }
  | { type: "exported"; id: string; kind: "pdf" | "goodnotes"; files: string[] }
  | { type: "template-ok"; id: string; pageSize: [number, number]; hasInk: boolean }
  | { type: "template-cleared"; id: string }
  | { type: "hand-set"; id: string; count: number }
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
    case "hand-set": return isStr(m.id) && typeof m.count === "number" ? { type: "hand-set", id: m.id, count: m.count } : null;
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

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Base64 → Bytes ohne atob/Buffer (läuft überall, auch unter Hermes). */
export function base64ToBytes(b64: string): Uint8Array {
  const s = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const a = B64.indexOf(s[i]!), b = B64.indexOf(s[i + 1] ?? "A"), c = s[i + 2] === undefined ? -1 : B64.indexOf(s[i + 2]!), d = s[i + 3] === undefined ? -1 : B64.indexOf(s[i + 3]!);
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (c >= 0 && o < out.length) out[o++] = (n >> 8) & 255;
    if (d >= 0 && o < out.length) out[o++] = n & 255;
  }
  return out;
}

/** Bytes → Base64 (für Vorlagen, die zur Engine gehen). */
export function bytesToBase64(bytes: Uint8Array): string {
  let r = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    r += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (b === undefined ? "=" : B64[(n >> 6) & 63]!) + (c === undefined ? "=" : B64[n & 63]!);
  }
  return r;
}

/** Regler wie im Web (index.html: sizeInput, widthInput, jitterInput). */
export const RANGES = {
  size: { min: 0.7, max: 1.6, step: 0.05 },
  weight: { min: 0.3, max: 3, step: 0.05 },
  jitter: { min: 0, max: 2, step: 0.1 },
} as const;
export type RangeId = keyof typeof RANGES;

/** Einen Schritt hoch oder runter, auf die Schrittweite gerundet und begrenzt (kein 0.30000000000000004). */
export function stepValue(id: RangeId, value: number, dir: 1 | -1): number {
  const { min, max, step } = RANGES[id];
  const next = Math.round((value + dir * step) / step) * step;
  return Math.min(max, Math.max(min, Math.round(next * 1000) / 1000));
}

/** Anzeigetexte wie im Web. */
export function rangeLabel(id: RangeId, value: number): string {
  if (id === "size") return `${value.toFixed(1)}×`;
  if (id === "weight") return Math.abs(value - 1) < 0.001 ? "wie die Schrift" : `${value.toFixed(2)}×`;
  return value < 0.4 ? "keine" : value < 0.9 ? "wenig" : value < 1.3 ? "mittel" : "stark";
}

/* ---------- Zeichenfeld für die eigene Handschrift (eigene WebView) ---------- */

/** App → Pad */
export type PadRequest =
  | { type: "init"; packed: unknown | null; ink: string }
  | { type: "goto"; idx: number }
  | { type: "prev" } | { type: "next" } | { type: "undo" } | { type: "clear" }
  | { type: "pack"; id: string };

export interface PadState { idx: number; char: string; total: number; done: boolean[]; doneCount: number; current: boolean; }

/** Pad → App */
export type PadMessage =
  | { type: "pad-ready" }
  | ({ type: "pad-state" } & PadState)
  | { type: "packed"; id: string; packed: { v: number; glyphs: Record<string, unknown> } }
  | { type: "pad-error"; id: string; message: string };

export function parsePadMessage(raw: unknown): PadMessage | null {
  let m: any;
  try { m = typeof raw === "string" ? JSON.parse(raw) : null; } catch (_) { return null; }
  if (!m || typeof m !== "object") return null;
  switch (m.type) {
    case "pad-ready": return { type: "pad-ready" };
    case "pad-state":
      return typeof m.idx === "number" && isStr(m.char) && typeof m.total === "number" && Array.isArray(m.done) && m.done.every((d: unknown) => typeof d === "boolean") && typeof m.doneCount === "number"
        ? { type: "pad-state", idx: m.idx, char: m.char, total: m.total, done: m.done, doneCount: m.doneCount, current: !!m.current } : null;
    case "packed": return isStr(m.id) && m.packed && typeof m.packed === "object" && m.packed.glyphs && typeof m.packed.glyphs === "object"
      ? { type: "packed", id: m.id, packed: { v: typeof m.packed.v === "number" ? m.packed.v : 1, glyphs: m.packed.glyphs } } : null;
    case "pad-error": return { type: "pad-error", id: isStr(m.id) ? m.id : "", message: isStr(m.message) && m.message ? m.message : "Unbekannter Fehler." };
    default: return null;
  }
}

/** Text der „Weiter“-Taste im Zeichenfeld (Web: updatePad). */
export const padNextLabel = (idx: number, total: number, currentDrawn: boolean): string =>
  idx === total - 1 ? "Fertig" : currentDrawn ? "Weiter" : "Überspringen";

export const padProgressLabel = (s: Pick<PadState, "idx" | "total" | "doneCount">): string => `Zeichen ${s.idx + 1} von ${s.total} · ${s.doneCount} gezeichnet`;

/** Anzeige für die Verformung (Web: handVaryVal). */
export const handVaryLabel = (v: number): string => (v < 0.7 ? "leicht" : v <= 1.4 ? "mittel" : "stark");
export const HAND_VARY = { min: 0.2, max: 2, step: 0.1, default: 1 } as const;
