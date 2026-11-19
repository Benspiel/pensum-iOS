/* Notenrechner – kurze Hinweise (Web: toast() aus /js/shell.js). Es gibt kein gemeinsames Toast-System, daher hier eine kleine eigene Zeile. */
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "../../../ui";
import { radius, spacing, usePensumTheme } from "../../../theme";

export interface ToastMessage { id: number; text: string; error: boolean }

/** Hinweis anzeigen (verschwindet nach 5 s, per Tipp früher) und für VoiceOver ansagen. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);
  const show = useCallback((text: string, error = false) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++counter.current, text, error });
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => { timer.current = null; setToast(null); }, 5000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { toast, show, hide };
}

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const { colors } = usePensumTheme();
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={toast.text}
        accessibilityHint="Zum Schließen tippen"
        onPress={onDismiss}
        style={[styles.toast, { backgroundColor: toast.error ? colors.dangerSurface : colors.ink }]}
      >
        <AppText style={{ color: toast.error ? colors.danger : colors.onPrimary }}>{toast.text}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg, alignItems: "center" },
  toast: { minHeight: 48, maxWidth: 560, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.field, borderCurve: "continuous", justifyContent: "center" },
});
