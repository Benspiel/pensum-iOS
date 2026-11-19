import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ImageSource = { uri: string; width: number; height: number };
export type PreparedImage = ImageSource & { base64: string };

// Pensum web tools/abschreiben/core.js @ 770dbe4. Keep within the Function's 2.4M limit.
export const MAX_BASE64 = 1_900_000;
const QUALITIES = [0.82, 0.7, 0.58, 0.46];

export function fitSize(width: number, height: number, max = 1800) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export async function pickPhoto(source: 'camera' | 'library'): Promise<ImageSource | null> {
  if (source === 'camera') {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    if (!camera.granted) throw new Error('Erlaube Pensum den Kamerazugriff in den iOS-Einstellungen.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0] ?? null;
}

export function removeTemporaryFile(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // A cleared cache or an already removed file needs no further cleanup.
  }
}

export async function prepareImage(source: ImageSource, maxSide = 1800): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(source.uri);
  try {
    const size = fitSize(source.width, source.height, maxSide);
    if (size.width !== source.width || size.height !== source.height) context.resize(size);
    const rendered = await context.renderAsync();
    try {
      for (const compress of QUALITIES) {
        const result = await rendered.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
        try {
          if (result.base64 && result.base64.length <= MAX_BASE64) {
            return { uri: source.uri, width: result.width, height: result.height, base64: result.base64 };
          }
        } finally {
          removeTemporaryFile(result.uri);
        }
      }
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
  throw new Error('Das Bild ist zu groß. Wähle einen kleineren Ausschnitt.');
}
