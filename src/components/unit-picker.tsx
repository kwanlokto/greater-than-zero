import { OptionPicker } from '@/components/option-picker';
import { weightUnits, type WeightUnit } from '@/core/tracker';

const unitLabels: Record<WeightUnit, string> = {
  lb: 'Pounds (lb)',
  kg: 'Kilograms (kg)',
};

type Props = {
  value?: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  // Taller, for when the choice is the point of the screen.
  large?: boolean;
};

export function UnitPicker({ value, onChange, large }: Props) {
  return (
    <OptionPicker
      options={weightUnits}
      labels={unitLabels}
      value={value}
      onChange={onChange}
      large={large}
    />
  );
}
