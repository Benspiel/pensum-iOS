import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { GOODNOTES_HOST_HTML, GOODNOTES_PAD_HTML } from '../src/features/goodnotes/host-html.generated';
import { DEFAULT_SETTINGS, type HostMessage, type HostRequest } from '../src/features/goodnotes/protocol';

test('Goodnotes exports the requested text even when the visible preview is older', { timeout: 2000 }, async () => {
  const listeners: ((event: { data: string }) => void)[] = [];
  const result = Promise.withResolvers<Extract<HostMessage, { type: 'exported' }>>();
  const engine = {
    state: { ...DEFAULT_SETTINGS },
    fontSpec: () => '40px Caveat',
    render(text: string) {
      const snapshot = { text, font: this.state.font, toDataURL: () => 'data:image/png;base64,' };
      return { canvases: [snapshot], inkPages: [] };
    },
    buildPdf(pages: { text: string; font: string }[]) {
      return Buffer.from(`${pages[0]?.text} · ${pages[0]?.font}`);
    },
  };
  class TestReader {
    result = '';
    onload?: () => void;

    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((bytes) => {
        this.result = 'data:application/pdf;base64,' + Buffer.from(bytes).toString('base64');
        this.onload?.();
      });
    }
  }

  runInNewContext(readFileSync('src/features/goodnotes/engine/host-bridge.js', 'utf8'), {
    Blob,
    FileReader: TestReader,
    createInkEngine: () => engine,
    document: { fonts: { load: async () => [] }, addEventListener: () => undefined },
    window: {
      addEventListener: (_type: string, listener: (event: { data: string }) => void) => listeners.push(listener),
      ReactNativeWebView: {
        postMessage(raw: string) {
          const message = JSON.parse(raw) as HostMessage;
          if (message.type === 'exported') result.resolve(message);
          if (message.type === 'error') result.reject(new Error(message.message));
        },
      },
    },
  });

  function send(message: HostRequest) {
    const listener = listeners[0];
    assert.ok(listener);
    listener({ data: JSON.stringify(message) });
  }

  send({ type: 'render', id: 'preview', text: 'Alte Vorschau', settings: DEFAULT_SETTINGS });
  send({ type: 'export-pdf', id: 'export', text: 'Aktuelle Notiz', settings: { ...DEFAULT_SETTINGS, font: 'Kalam' } });
  const exported = await result.promise;
  assert.equal(exported.id, 'export');
  assert.equal(Buffer.from(exported.files[0] ?? '', 'base64').toString('utf8'), 'Aktuelle Notiz · Kalam');
});

test('both bundled Goodnotes pages prohibit network requests', () => {
  for (const html of [GOODNOTES_HOST_HTML, GOODNOTES_PAD_HTML]) {
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.ok(html.includes("default-src 'none'"));
    assert.ok(html.includes("connect-src 'none'"));
    assert.ok(html.includes("font-src data:"));
  }
});
