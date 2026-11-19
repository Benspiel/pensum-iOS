/* Vier gewinnt – Stärke des Computers (Web: segmented „Stärke des Computers“, Leicht/Mittel/Schwer). */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme";
import { AppText, Button } from "../../../ui";
import { LEVELS, LEVEL_IDS, type LevelId } from "../model";

export function LevelPicker({ level, onPick }: { level: LevelId; onPick: (id: LevelId) => void }) {
  return (
    <View style={styles.wrap}>
      <AppText variant="label">Stärke des Computers</AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="Stärke des Computers" style={styles.row}>
        {LEVEL_IDS.map((id) => (
          <Button
            key={id}
            title={LEVELS[id].label}
            accessibilityRole="radio"
            accessibilityState={{ checked: id === level }}
            variant={id === level ? "primary" : "secondary"}
            onPress={() => onPick(id)}
            style={styles.item}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  item: { flexGrow: 1, flexBasis: 90 },
});
