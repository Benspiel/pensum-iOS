/* Zerlegt eine KI-Antwort in Text und Lösungsfenster (Web `formatMessage` in tools/kichat/core.js). */

export type MessagePart = { kind: 'text'; text: string } | { kind: 'solution'; text: string };

/** Zerlegt eine Antwort in Textteile und Lösungsfenster; andere Codeblöcke verlieren nur die Zaunzeilen. */
export function splitMessage(source: string): MessagePart[] {
  const parts: MessagePart[] = [];
  source.replace(/\r\n?/g, '\n').split('```').forEach((part, index) => {
    if (index % 2 === 0) {
      if (part.trim()) parts.push({ kind: 'text', text: part.trim() });
      return;
    }
    const body = part.replace(/^[^\n]*\n/, '').replace(/\n+$/, '').trim();
    if (!body) return;
    parts.push(/^\s*l(ö|oe)sung\s*\n/i.test(part) ? { kind: 'solution', text: body } : { kind: 'text', text: body });
  });
  return parts;
}
