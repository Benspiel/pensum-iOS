/* Goodnotes – Vollbild-Betrachter: Tipp auf die Vorschau zeigt den Zettel groß, zwischen Seiten wischen, auf iOS mit zwei Fingern zoomen. */
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing } from "../../theme";
import { AppText } from "../../ui";

export const A4_ASPECT = 595.28 / 841.89;

export function PreviewViewer({ pages, index, onClose }: { pages: string[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [current, setCurrent] = useState(index ?? 0);
  const visible = index !== null;

  useEffect(() => {
    if (index === null) return;
    setCurrent(index);
    // Nach dem Einblenden zur angetippten Seite springen
    const timer = setTimeout(() => scroller.current?.scrollTo({ x: index * width, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [index, width]);

  const top = Math.max(insets.top, spacing.lg) + 56;
  const bottom = Math.max(insets.bottom, spacing.lg) + 28;
  const maxW = width - 2 * spacing.lg;
  const maxH = Math.max(0, height - top - bottom);
  const pageW = Math.floor(Math.min(maxW, maxH * A4_ASPECT));
  const pageH = Math.floor(pageW / A4_ASPECT);
  const total = pages.length;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent supportedOrientations={["portrait", "landscape"]} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Vorschau schließen" style={StyleSheet.absoluteFill} onPress={onClose} />
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={[StyleSheet.absoluteFill, { top }]}
          contentContainerStyle={{ height: height - top - bottom }}
          onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)))}
          accessibilityLabel="Seiten des Zettels"
        >
          {pages.map((uri, i) => (
            <ScrollView
              key={uri + i}
              style={{ width, height: height - top - bottom }}
              contentContainerStyle={[styles.zoomContent, { width, height: height - top - bottom }]}
              minimumZoomScale={1}
              maximumZoomScale={Platform.OS === "ios" ? 4 : 1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Pressable accessibilityRole="image" accessibilityLabel={`Seite ${i + 1} von ${total}`} onPress={onClose} style={{ width: pageW, height: pageH }}>
                <Image source={{ uri }} resizeMode="contain" style={[styles.page, { width: pageW, height: pageH }]} />
              </Pressable>
            </ScrollView>
          ))}
        </ScrollView>

        <View pointerEvents="box-none" style={[styles.head, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
          <View style={styles.counter}>
            <AppText variant="label" style={styles.light}>{total ? `Seite ${Math.min(current + 1, total)} von ${total}` : "Vorschau"}</AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} onPress={onClose} style={styles.close}>
            <SymbolView name={{ ios: "xmark", android: "close", web: "close" }} size={18} weight="semibold" tintColor="#ffffff" />
          </Pressable>
        </View>
        {total > 1 ? <AppText variant="caption" style={[styles.hint, { bottom: Math.max(insets.bottom, spacing.lg) }]}>Zum Blättern wischen · zum Schließen tippen</AppText> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)" },
  zoomContent: { alignItems: "center", justifyContent: "center" },
  page: { backgroundColor: "#ffffff", borderRadius: radius.field, borderCurve: "continuous" },
  head: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  counter: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)" },
  light: { color: "#ffffff" },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  hint: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.7)" },
});
