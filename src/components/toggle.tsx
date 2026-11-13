import { Switch } from 'react-native';

import { useAppTheme } from '@/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

// An on/off switch in the app's colours rather than the system's.
export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();

  return (
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.primary, false: colors.field }}
      thumbColor={value ? colors.onPrimary : colors.textFaint}
    />
  );
}
