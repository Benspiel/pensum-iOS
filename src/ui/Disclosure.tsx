import { SymbolView } from "expo-symbols";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText, Panel } from "./index";
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
  const panelInset = gutter(width);
  return (
    <Panel style={styles.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={[styles.head, large && { paddingHorizontal: panelInset, paddingVertical: spacing.lg }]}
      >
        <AppText variant={large ? "h4" : "link"} style={styles.title}>{title}</AppText>
        {large ? (
          <SymbolView accessible={false} size={16} tintColor={colors.muted} name={open
            ? { ios: "chevron.up", android: "expand_less", web: "expand_less" }
            : { ios: "chevron.down", android: "expand_more", web: "expand_more" }} />
        ) : (
          <AppText variant="h4" accessible={false}>{open ? "–" : "+"}</AppText>
        )}
      </Pressable>
      {open ? <View style={[styles.body, large && { paddingHorizontal: panelInset, paddingBottom: panelInset }]}>{children}</View> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  box: { padding: 0, gap: 0 },
  head: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  title: { flexShrink: 1 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
