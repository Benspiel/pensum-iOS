// Erzeugt src/features/mindmap/inter-widths.generated.ts aus den gebündelten Inter-Schriften (assets/fonts).
// Liest nur Vorschubbreiten (hmtx) über die Zeichenzuordnung (cmap). Kein Netz, keine Abhängigkeiten.
// Aufruf: node src/features/mindmap/build-inter-widths.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const faces = [['regular', 'Inter_400Regular.ttf'], ['semibold', 'Inter_600SemiBold.ttf']];

function widthsOf(file) {
  const buf = fs.readFileSync(path.join(root, 'assets/fonts', file));
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tables = {};
  const count = view.getUint16(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    tables[buf.toString('latin1', at, at + 4)] = view.getUint32(at + 8);
  }
  const upm = view.getUint16(tables.head + 18);
  const metrics = view.getUint16(tables.hhea + 34);
  const advance = (gid) => view.getUint16(tables.hmtx + Math.min(gid, metrics - 1) * 4);
  // cmap: Format 12 (Unicode voll) bevorzugt, sonst Format 4
  const cm = tables.cmap, n = view.getUint16(cm + 2);
  let sub = null;
  for (let i = 0; i < n; i++) {
    const platform = view.getUint16(cm + 4 + i * 8), encoding = view.getUint16(cm + 6 + i * 8), offset = cm + view.getUint32(cm + 8 + i * 8);
    const format = view.getUint16(offset);
    if (format === 12 || (format === 4 && platform === 3 && encoding === 1 && !sub)) sub = { offset, format };
  }
  const glyphOf = (cp) => {
    const o = sub.offset;
    if (sub.format === 12) {
      const groups = view.getUint32(o + 12);
      for (let g = 0; g < groups; g++) {
        const at = o + 16 + g * 12, start = view.getUint32(at), end = view.getUint32(at + 4);
        if (cp >= start && cp <= end) return view.getUint32(at + 8) + (cp - start);
      }
      return 0;
    }
    const segX2 = view.getUint16(o + 6), ends = o + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2; s += 2) {
      if (cp > view.getUint16(ends + s)) continue;
      if (cp < view.getUint16(starts + s)) return 0;
      const range = view.getUint16(ranges + s), delta = view.getInt16(deltas + s);
      if (!range) return (cp + delta) & 0xffff;
      const gid = view.getUint16(ranges + s + range + (cp - view.getUint16(starts + s)) * 2);
      return gid ? (gid + delta) & 0xffff : 0;
    }
    return 0;
  };
  const out = {};
  const wanted = [];
  for (let cp = 0x20; cp <= 0x24f; cp++) wanted.push(cp);
  wanted.push(0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x20ac, 0x2192, 0x2212);
  for (const cp of wanted) {
    const gid = glyphOf(cp);
    if (cp >= 0x80 && cp < 0xa0) continue;
    if (gid || cp === 0x20) out[String.fromCodePoint(cp)] = Math.round((advance(gid) / upm) * 1000);
  }
  return out;
}

const tables = Object.fromEntries(faces.map(([name, file]) => [name, widthsOf(file)]));
const body = Object.entries(tables).map(([name, t]) => `  ${name}: ${JSON.stringify(t)},`).join('\n');
const text = `/* GENERIERT von src/features/mindmap/build-inter-widths.mjs aus assets/fonts – nicht von Hand ändern.
 * Vorschubbreiten der Inter-Schnitte in Tausendstel Geviert (ohne Kerning). */
export const INTER_WIDTHS: Record<'regular' | 'semibold', Record<string, number>> = {
${body}
};
`;
fs.writeFileSync(path.join(here, 'inter-widths.generated.ts'), text);
console.log('inter-widths.generated.ts', (text.length / 1000).toFixed(1), 'kB', Object.keys(tables.regular).length, 'Zeichen');
