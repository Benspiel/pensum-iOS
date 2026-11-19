import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.title}>Alles fürs Pensum.</Text>
      <Text style={styles.description}>Schul-Tools an einem Ort.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 36, fontWeight: '700' },
  description: { fontSize: 17 },
});
