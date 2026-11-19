/* Karteikarten mit KI – Foto oder PDF wählen und für das Senden vorbereiten (Web: prepareFile in tools/karteikarten/ki.js, Web-Commit 770dbe4).
 * Native Umsetzung statt Canvas/FileReader: expo-image-picker und expo-image-manipulator über die Hilfen von A (appwrite-tools/images:
 * längste Kante 1800, JPEG-Qualitäten 0.82, 0.7, 0.58, 0.46 bis Base64 ≤ MAX_BASE64), PDF über expo-document-picker unverändert (bis 2,5 MiB). */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { pickPhoto, prepareImage, removeTemporaryFile } from "../../appwrite-tools/images";
import { MAX_FILE, MAX_PDF } from "./cards";

export type KiFile =
  | { kind: "image"; name: string; uri: string; width: number; height: number }
  | { kind: "pdf"; name: string; uri: string };

export type KiFileSource = "camera" | "library" | "pdf";

export const PDF_TOO_BIG = "Das PDF ist zu groß (höchstens ca. 2,5 MB).";
export const IMAGE_TOO_BIG = "Das Bild ist zu groß. Wähle ein kleineres Bild.";
/** Obergrenze des Base64-Textes beim PDF (IMAGE.maxPdfBase64 der Function). */
const PDF_BASE64_MAX = 3_500_000;

function sizeOf(uri: string, known?: number | null): number | null {
  if (typeof known === "number" && known > 0) return known;
  try { return new File(uri).size; } catch { return null; }
}

/** Wählt ein Foto (Kamera, Mediathek) oder ein PDF. Gibt null zurück, wenn die Auswahl abgebrochen wird; wirft mit deutscher Meldung bei zu großen Dateien. */
export async function pickKiFile(source: KiFileSource): Promise<KiFile | null> {
  if (source === "pdf") {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return null;
    const size = sizeOf(asset.uri, asset.size);
    if (!size || size > MAX_PDF) {
      removeTemporaryFile(asset.uri);
      throw new Error(PDF_TOO_BIG);
    }
    return { kind: "pdf", name: asset.name, uri: asset.uri };
  }
  const photo = await pickPhoto(source);
  if (!photo) return null;
  const size = sizeOf(photo.uri);
  if (size !== null && size > MAX_FILE) {
    removeTemporaryFile(photo.uri);
    throw new Error(IMAGE_TOO_BIG);
  }
  return { kind: "image", name: "Foto", uri: photo.uri, width: photo.width, height: photo.height };
}

/** Base64 für die Anfrage: Bild verkleinert (JPEG), PDF unverändert. */
export async function prepareKiFile(file: KiFile): Promise<string> {
  if (file.kind === "image") return (await prepareImage({ uri: file.uri, width: file.width, height: file.height })).base64;
  const base64 = await new File(file.uri).base64();
  if (base64.length > PDF_BASE64_MAX) throw new Error(PDF_TOO_BIG);
  return base64;
}

/** Räumt die temporäre Kopie auf, wenn die Datei nicht mehr gebraucht wird. */
export function discardKiFile(file: KiFile): void {
  removeTemporaryFile(file.uri);
}
