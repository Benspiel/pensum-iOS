import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Animated, LayoutAnimation, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Panel } from "./index";
import { DURATION, Reveal, useReduceMotion, useToggleValue } from "./motion";
import { gutter, spacing, usePensumTheme } from "../theme";

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [
          styles.head,
          large && { paddingHorizontal: panelInset, paddingVertical: spacing.lg },
          { opacity: pressed ? 0.6 : 1 },
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
      </Pressable>
      {open ? (
        <Reveal distance={6} duration={DURATION.change + 60} style={[styles.body, large && { paddingHorizontal: panelInset, paddingBottom: panelInset }]}>
          {children}
        </Reveal>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  box: { padding: 0, gap: 0, overflow: "hidden" },
  head: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  title: { flexShrink: 1 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
