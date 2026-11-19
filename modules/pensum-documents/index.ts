import { requireOptionalNativeModule } from 'expo';

type PageImage = { uri: string; width: number; height: number };
type Answer = { box: [number, number, number, number]; text: string };
type NativeDocuments = {
  pdfPageCount(uri: string): Promise<number>;
  renderPDFPage(uri: string, page: number): Promise<PageImage>;
  exportWorksheet(uri: string, answers: Answer[], handwritten: boolean, pdf: boolean): Promise<string>;
};

export function documents() {
  const module = requireOptionalNativeModule<NativeDocuments>('PensumDocuments');
  if (!module) throw new Error('Diese Dateifunktion benötigt einen aktuellen iOS-Build von Pensum.');
  return module;
}
