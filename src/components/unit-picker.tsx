import { OptionPicker } from '@/components/option-picker';
import { weightUnits, type WeightUnit } from '@/core/tracker';

const unitLabels: Record<WeightUnit, string> = {
  lb: 'Pounds (lb)',
  kg: 'Kilograms (kg)',
};

const unitNames: Record<WeightUnit, string> = {
  lb: 'Pounds',
  kg: 'Kilograms',
};

type Props = {
  value?: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  // Taller, for when the choice is the point of the screen.
  large?: boolean;
  // Just "lb" and "kg", to sit at the end of a list row.
  compact?: boolean;
};

export function UnitPicker({ value, onChange, large, compact }: Props) {
  return (
    <OptionPicker
      options={weightUnits}
      labels={compact ? weightUnitsByName : unitLabels}
      accessibilityLabels={compact ? unitNames : undefined}
      accessibilityLabel="Weight unit"
      value={value}
      onChange={onChange}
      large={large}
      compact={compact}
    />
  );
}

const weightUnitsByName: Record<WeightUnit, string> = { lb: 'lb', kg: 'kg' };
