import { useTheme } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { weightUnits, type WeightUnit } from '@/core/tracker';

const unitLabels: Record<WeightUnit, string> = {
  lb: 'Pounds (lb)',
  kg: 'Kilograms (kg)',
};

type Props = {
  value?: WeightUnit;
  onChange: (unit: WeightUnit) => void;
};

export function UnitPicker({ value, onChange }: Props) {
  const { colors } = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {weightUnits.map(unit => {
        const selected = unit === value;
        return (
          <Pressable
            key={unit}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(unit)}
            style={[
              styles.option,
              {
                borderColor: colors.primary,
                backgroundColor: selected ? colors.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.label, { color: selected ? '#ffffff' : colors.text }]}>
              {unitLabels[unit]}
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
