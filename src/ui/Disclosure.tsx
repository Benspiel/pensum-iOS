/* Aufklappbarer Bereich wie die FAQ-Zeilen der Website (`css/pensum.css` `.faq-row`): getönte Fläche mit Radius 16,
 * Kopfzeile mindestens 56 hoch, Pfeil dreht sich. Auf- und Zuklappen gibt eine kurze Rückmeldung (Web: haptic("open"/"close")). */
import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Animated, LayoutAnimation, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Panel } from "./index";
import { DURATION, PressableScale, Reveal, useReduceMotion, useToggleValue } from "./motion";
import { haptic } from "./haptics";
import { gutter, radius, spacing, usePensumTheme } from "../theme";

export function Disclosure({ title, children, defaultOpen = false, large = false }: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  large?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { colors } = usePensumTheme();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const panelInset = gutter(width);
  const turn = useToggleValue(open, DURATION.change);

  function toggle() {
    haptic(open ? "close" : "open");
    // Die Höhe gleitet mit (LayoutAnimation), der Inhalt blendet dazu ein bzw. aus.
    if (!reduce) {
      LayoutAnimation.configureNext({
        duration: DURATION.change + 40,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }
    setOpen((o) => !o);
  }

  return (
    <Panel style={styles.box}>
      <PressableScale
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [
          styles.head,
          large && { paddingHorizontal: panelInset, paddingVertical: spacing.lg },
          { backgroundColor: pressed ? colors.border : "transparent" },
        ]}
      >
        <AppText variant={large ? "h4" : "link"} style={styles.title}>{title}</AppText>
        <Animated.View accessible={false} style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
          <SymbolView
            accessible={false}
            size={large ? 16 : 14}
            tintColor={colors.muted}
            name={{ ios: "chevron.down", android: "expand_more", web: "expand_more" }}
          />
        </Animated.View>
      </PressableScale>
      {open ? (
        <Reveal distance={6} duration={DURATION.change + 60} style={[styles.body, large && { paddingHorizontal: panelInset, paddingBottom: panelInset }]}>
          {children}
        </Reveal>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  /** Web `.faq-row`: Radius 16 (nicht 24 wie eine Karte), damit aufklappbare Zeilen ruhiger wirken. */
  box: { padding: 0, gap: 0, overflow: "hidden", borderRadius: radius.field },
  head: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  title: { flexShrink: 1 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
