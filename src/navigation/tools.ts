import type { SymbolViewProps } from 'expo-symbols';

import { noToolAccess, type ToolAccess } from '../contracts';
import { aiEnabled } from '../backend/config';

// Sichtbarkeit und Reihenfolge folgen Pensum js/tools.js und js/home.js (770dbe4). Spiele sind vom iOS-Umfang ausgenommen.
export const TOOL_ORDER = [
  'goodnotes', 'mindmap', 'kichat', 'aufgaben', 'abschreiben', 'karteikarten',
  'planer', 'videos', 'admin', 'notenrechner',
] as const;

export type ToolId = (typeof TOOL_ORDER)[number];
export type ToolImplementation = 'unavailable' | 'native' | 'web';
export type ToolAvailability = 'available' | 'locked' | 'hidden';

export interface Tool {
  id: ToolId;
  title: string;
  description: string;
  symbol: SymbolViewProps['name'];
  access: 'public' | keyof ToolAccess;
  implementation: ToolImplementation;
}

const definitions: Record<ToolId, Omit<Tool, 'id'>> = {
  goodnotes: {
    title: 'Handschrift-Tool',
    description: 'Text in Handschrift verwandeln und als Goodnotes-Datei oder PDF exportieren.',
    symbol: { ios: 'pencil.line', android: 'draw', web: 'draw' },
    access: 'public',
    implementation: 'native',
  },
  mindmap: {
    title: 'Mindmap-Generator',
    description: 'Ein Thema mit KI in einer Mindmap aufbereiten und im Editor weiterbearbeiten.',
    symbol: { ios: 'point.3.connected.trianglepath.dotted', android: 'account_tree', web: 'account_tree' },
    access: 'public',
    implementation: aiEnabled ? 'native' : 'unavailable',
  },
  kichat: {
    title: 'KI-Chat',
    description: 'Mit der Gemini-KI chatten und Unterhaltungen im Konto weiterführen.',
    symbol: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
    access: 'kiTester',
    implementation: aiEnabled ? 'native' : 'unavailable',
  },
  aufgaben: {
    title: 'Aufgaben',
    description: 'Ein Arbeitsblatt mit KI ausfüllen und das Ergebnis als PDF oder Bild exportieren.',
    symbol: { ios: 'checkmark.rectangle', android: 'assignment_turned_in', web: 'assignment_turned_in' },
    access: 'tester',
    implementation: aiEnabled ? 'native' : 'unavailable',
  },
  abschreiben: {
    title: 'Abschreiben',
    description: 'Text aus einem Tafelbild erkennen, kopieren oder in Handschrift umwandeln.',
    symbol: { ios: 'camera.viewfinder', android: 'document_scanner', web: 'document_scanner' },
    access: 'public',
    implementation: aiEnabled ? 'native' : 'unavailable',
  },
  karteikarten: {
    title: 'Karteikarten',
    description: 'Eigene Lernstapel erstellen und Karten mündlich oder schriftlich lernen.',
    symbol: { ios: 'rectangle.on.rectangle', android: 'style', web: 'style' },
    access: 'public',
    implementation: 'native',
  },
  planer: {
    title: 'Planer',
    description: 'Hausaufgaben und Klausuren planen und mit Lernstapeln verknüpfen.',
    symbol: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    access: 'public',
    implementation: 'native',
  },
  videos: {
    title: 'Erklärvideos',
    description: 'Passende Erklärvideos von Lehrer Schmidt zu einem Thema finden.',
    symbol: { ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' },
    access: 'tester',
    implementation: 'unavailable',
  },
  notenrechner: {
    title: 'Notenrechner',
    description: 'Fächer und Leistungen erfassen und den Zeugnisdurchschnitt berechnen.',
    symbol: { ios: 'percent', android: 'percent', web: 'percent' },
    access: 'public',
    implementation: 'native',
  },
  admin: {
    title: 'Team',
    description: 'Plattformzahlen und die Nutzung der Pensum-Tools ansehen.',
    symbol: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
    access: 'admin',
    implementation: 'native',
  },
};

export const tools: readonly Tool[] = TOOL_ORDER.map((id) => ({ id, ...definitions[id] }));

export function getTool(id: string | undefined) {
  return tools.find((tool) => tool.id === id);
}

export function getToolAvailability(tool: Tool, access: ToolAccess = noToolAccess): ToolAvailability {
  if (tool.implementation === 'unavailable') return 'hidden';
  if (tool.access === 'public' || access[tool.access]) return 'available';
  return tool.access === 'tester' ? 'locked' : 'hidden';
}
