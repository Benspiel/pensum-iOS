import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { removeTemporaryFile } from './images';

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

export async function sharePdf(html: string, dialogTitle: string) {
  if (!await isAvailableAsync()) throw new Error('Teilen ist auf diesem Gerät nicht verfügbar.');
  const { uri } = await printToFileAsync({ html });
  try {
    await shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } finally {
    removeTemporaryFile(uri);
  }
}
