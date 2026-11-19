/* Planer – kleine Hinweiszeile unten (Web: toast()). Verschwindet nach ein paar Sekunden; wird Screenreadern vorgelesen. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
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
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={styles.host}>
      <View
        accessible
        accessibilityRole={toast.error ? "alert" : "text"}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: toast.error ? colors.dangerSurface : colors.ink, borderColor: toast.error ? colors.danger : colors.ink }]}
      >
        <AppText variant="label" style={{ color: toast.error ? colors.danger : colors.onPrimary }}>{toast.text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, alignItems: "center" },
  toast: { maxWidth: 560, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth },
});
