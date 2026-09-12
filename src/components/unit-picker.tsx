import { OptionPicker } from '@/components/option-picker';
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
  return <OptionPicker options={weightUnits} labels={unitLabels} value={value} onChange={onChange} />;
}
