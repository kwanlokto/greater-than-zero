import { useTheme } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

// Stands in for a tab until its feature is built.
export function PlaceholderScreen({ description }: { description: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: colors.text }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
});
