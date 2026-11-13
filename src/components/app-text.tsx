import { Text, type TextProps } from 'react-native';

import { maxFontScale, type, useAppTheme, type Palette, type TextVariant } from '@/theme';

export type TextTone = 'default' | 'muted' | 'faint' | 'primary' | 'danger';

type Props = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function toneColor(colors: Palette, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'faint':
      return colors.textFaint;
    case 'primary':
      return colors.primary;
    case 'danger':
      return colors.danger;
    default:
      return colors.text;
  }
}

// Text in one of the app's sizes and colours.
export function AppText({ variant = 'body', tone = 'default', style, ...props }: Props) {
  const { colors } = useAppTheme();

  return (
    <Text
      maxFontSizeMultiplier={maxFontScale}
      {...props}
      style={[type[variant], { color: toneColor(colors, tone) }, style]}
    />
  );
}
