/* Planer – kleine Hinweiszeile unten (Web: .toast, invers in Ink, Fehler nur fett). Verschwindet nach ein paar Sekunden; wird Screenreadern vorgelesen. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export interface ToastMessage { id: number; text: string; error: boolean }
export type ShowToast = (text: string, options?: { error?: boolean }) => void;

export function useToast(): { toast: ToastMessage | null; show: ShowToast } {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ShowToast>((text, options = {}) => {
    if (timer.current) clearTimeout(timer.current);
    counter.current += 1;
    setToast({ id: counter.current, text, error: !!options.error });
    try { AccessibilityInfo.announceForAccessibility(text); } catch (_) { /* egal */ }
    timer.current = setTimeout(() => { timer.current = null; setToast(null); }, options.error ? 6000 : 3500);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, show };
}

export function ToastHost({ toast }: { toast: ToastMessage | null }) {
  const { colors } = usePensumTheme();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: spacing.xl + insets.bottom }]}>
      <View
        accessible
        accessibilityRole={toast.error ? "alert" : "text"}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: colors.ink }]}
      >
        {toast.error ? (
          <View accessible={false} style={[styles.mark, { backgroundColor: colors.onPrimary }]}>
            <AppText variant="label" style={{ color: colors.ink }}>!</AppText>
          </View>
        ) : null}
        <AppText variant="bodySm" style={[{ color: colors.onPrimary }, toast.error && styles.bold, styles.text]}>{toast.text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: { maxWidth: 560, flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous" },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  text: { flexShrink: 1 },
  bold: { fontWeight: "600" },
});
