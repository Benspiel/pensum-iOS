/* Goodnotes-Tool – Engine-Ansicht im Web: ein Iframe mit `srcdoc`, das die Engine-Seite lädt.
 * Die Engine spricht über `window.ReactNativeWebView.postMessage` (Antworten) und `window`-Nachrichten (Anfragen).
 * Die Brücke unten stellt genau das im Iframe bereit, sodass screen.tsx, HandPad.tsx und der Kanal unverändert bleiben. */
import { createElement, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type WebViewMessageEvent = { nativeEvent: { data: string } };

export interface WebViewHandle {
  postMessage: (data: string) => void;
}

const BRIDGE = "<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({pensumWebView:m},'*')}};</script>";

export function WebView({ ref, source, onMessage, onError, style }: {
  ref?: Ref<WebViewHandle>;
  source: { html: string; baseUrl?: string };
  onMessage?: (event: WebViewMessageEvent) => void;
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
  [other: string]: unknown;
}) {
  const frame = useRef<{ contentWindow: Window | null } | null>(null);
  useImperativeHandle(ref, () => ({
    postMessage: (data: string) => { frame.current?.contentWindow?.postMessage(data, "*"); },
  }), []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data: unknown = event.data;
      if (data && typeof data === "object" && typeof (data as { pensumWebView?: unknown }).pensumWebView === "string") {
        onMessage?.({ nativeEvent: { data: (data as { pensumWebView: string }).pensumWebView } });
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onMessage]);

  const html = useMemo(() => source.html.replace(/^<!doctype html>/i, (doctype) => doctype + BRIDGE), [source.html]);

  return (
    <View style={style}>
      {createElement("iframe", {
        ref: frame,
        srcDoc: html,
        sandbox: "allow-scripts",
        title: "Engine",
        onError,
        style: { border: 0, width: "100%", height: "100%", background: "transparent" },
      })}
    </View>
  );
}
