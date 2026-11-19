import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  contrastRatio,
  faceForWeight,
  familyForWeight,
  fontFamilies,
  gutter,
  palette,
  radius,
  resolveTextStyle,
  squircleRadius,
  typeScale,
  type TextVariant,
} from '../src/theme/tokens';

const schemes = ['light', 'dark'] as const;

test('Textfarben erreichen WCAG AA (4,5:1) auf jeder Fläche, auf der sie vorkommen', () => {
  for (const scheme of schemes) {
    const c = palette[scheme];
    const pairs: [string, string, string][] = [
      ['ink', c.ink, c.canvas],
      ['ink auf surface', c.ink, c.surface],
      ['ink auf field', c.ink, c.field],
      ['inkSoft', c.inkSoft, c.canvas],
      ['muted auf canvas', c.muted, c.canvas],
      ['muted auf surface', c.muted, c.surface],
      ['muted auf field', c.muted, c.field],
      ['mutedOnCanvas auf canvas', c.mutedOnCanvas, c.canvas],
      ['accent auf canvas', c.accent, c.canvas],
      ['accent auf surface', c.accent, c.surface],
      ['accent auf accentSurface', c.accent, c.accentSurface],
      ['danger auf canvas', c.danger, c.canvas],
      ['danger auf surface', c.danger, c.surface],
      ['danger auf dangerSurface', c.danger, c.dangerSurface],
      ['onPrimary auf ink (Button primary)', c.onPrimary, c.ink],
      ['onAccent auf accentFill (Badge accent)', c.onAccent, c.accentFill],
    ];
    for (const [name, fg, bg] of pairs) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(ratio >= 4.5, `${scheme}: ${name} nur ${ratio.toFixed(2)}:1`);
    }
  }
});

test('Kontrastberechnung stimmt mit bekannten Werten überein', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrastRatio('#ffffff', '#ffffff').toFixed(2), '1.00');
});

test('Web-Tokens sind übernommen', () => {
  assert.equal(palette.light.ink, '#141414');
  assert.equal(palette.light.canvas, '#ffffff');
  assert.equal(palette.light.surface, '#f3f3f3');
  assert.equal(palette.light.field, '#f0f0f0');
  assert.equal(palette.light.border, '#e0e0e0');
  assert.equal(palette.light.hairlineSoft, '#f0f0f0');
  assert.equal(palette.light.accentFill, '#0066ff');
  assert.equal(palette.dark.canvas, '#121212');
  assert.equal(palette.dark.ink, '#f2f2f2');
  assert.equal(palette.dark.field, '#262626');
  assert.equal(palette.dark.border, '#333333');
  assert.equal(palette.dark.accentFill, '#3d8bff');
  assert.equal(palette.dark.onPrimary, '#141414');
  assert.equal(radius.field, 16);
  assert.equal(radius.card, 24);
  assert.equal(squircleRadius(56), 17);
  assert.equal(gutter(375), 16);
  assert.equal(gutter(768), 24);
});

test('beide Paletten haben dieselben Schlüssel (inkl. der bisherigen der App)', () => {
  assert.deepEqual(Object.keys(palette.light).sort(), Object.keys(palette.dark).sort());
  for (const key of ['canvas', 'surface', 'field', 'border', 'ink', 'muted', 'onPrimary', 'accent', 'accentSurface', 'danger', 'dangerSurface']) {
    assert.ok(key in palette.light, key);
  }
});

test('Gewichte werden dem nächsten statischen Inter-Schnitt zugeordnet', () => {
  assert.equal(faceForWeight(300), 'light');
  assert.equal(faceForWeight('400'), 'regular');
  assert.equal(faceForWeight(450), 'regular');
  assert.equal(faceForWeight(undefined), 'regular');
  assert.equal(faceForWeight('normal'), 'regular');
  assert.equal(faceForWeight('500'), 'medium');
  assert.equal(faceForWeight('600'), 'semibold');
  assert.equal(faceForWeight(650), 'semibold');
  assert.equal(faceForWeight('700'), 'bold');
  assert.equal(faceForWeight('bold'), 'bold');
  assert.equal(faceForWeight('900'), 'bold');
  assert.equal(familyForWeight('600'), 'Inter_600SemiBold');
});

test('Typografie: Web-Größen, Zeilenhöhen, kein negatives Letter-Spacing', () => {
  const px = (variant: TextVariant, wide = false) => resolveTextStyle(variant, { wide, customFonts: true });
  assert.deepEqual([px('display').fontSize, px('display').lineHeight], [44, 44]);
  assert.equal(px('display', true).fontSize, 56);
  assert.deepEqual([px('h1').fontSize, px('h1').lineHeight], [36, 36]);
  assert.deepEqual([px('h2').fontSize, px('h2').lineHeight], [30, 34]);
  assert.deepEqual([px('h3').fontSize, px('h3').lineHeight], [24, 27]);
  assert.deepEqual([px('h4').fontSize, px('h4').lineHeight], [20, 25]);
  assert.deepEqual([px('body').fontSize, px('body').fontFamily], [16, fontFamilies.regular]);
  assert.deepEqual([px('bodySm').fontSize, px('bodyLg').fontSize], [14, 18]);
  assert.equal(px('bodyLg').fontFamily, fontFamilies.light);
  assert.deepEqual([px('label').fontSize, px('label').fontFamily], [12, fontFamilies.semibold]);
  assert.equal(px('caption').fontSize, 12);
  assert.equal(px('link').fontFamily, fontFamilies.semibold);
  assert.deepEqual([px('section').fontSize, px('section').fontFamily], [20, fontFamilies.semibold]);
  for (const variant of Object.keys(typeScale) as TextVariant[]) {
    const style = px(variant, true);
    assert.equal(style.letterSpacing, 0, variant);
    assert.ok(style.lineHeight >= style.fontSize, variant);
  }
});

test('Überschriften nutzen den Überschriftenschnitt, Fließtext nicht', () => {
  for (const variant of ['display', 'h1', 'h2', 'h3', 'h4', 'title'] as const) {
    assert.equal(resolveTextStyle(variant, { customFonts: true }).fontFamily, fontFamilies.semibold, variant);
  }
  assert.notEqual(resolveTextStyle('body', { customFonts: true }).fontFamily, fontFamilies.semibold);
});

test('Ohne geladene Schrift greift die Systemschrift mit numerischem Gewicht', () => {
  const heading = resolveTextStyle('h1', { customFonts: false });
  assert.equal(heading.fontFamily, undefined);
  assert.equal(heading.fontWeight, '600');
  assert.equal(resolveTextStyle('bodyLg', { customFonts: false }).fontWeight, '300');
  assert.equal(resolveTextStyle('body', { customFonts: false }).fontWeight, '400');
});
