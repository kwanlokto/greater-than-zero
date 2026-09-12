import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props<T extends string> = {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (value: T) => void;
};

// A row of equal-width choices, for a handful of options.
export function OptionPicker<T extends string>({ options, labels, value, onChange }: Props<T>) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {options.map(option => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            style={[
              styles.option,
              {
                borderColor: colors.primary,
                backgroundColor: selected ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? '#ffffff' : colors.text }]}>
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
