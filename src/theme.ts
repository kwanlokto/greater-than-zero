import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { StyleSheet, useColorScheme } from 'react-native';

// The app's look in one place: colours for light and dark, spacing, corner
// radii and text sizes. Components read these rather than choosing their own.

export type Palette = {
  // The screen behind everything, and the cards and rows that sit on it.
  background: string;
  surface: string;
  // Text boxes and other filled controls.
  field: string;
  border: string;
  text: string;
  // Secondary text, and the faintest text that's still readable: placeholders.
  textMuted: string;
  textFaint: string;
  // The accent: main buttons, links, what's selected.
  primary: string;
  onPrimary: string;
  // A quiet tint of the accent, for less prominent buttons and badges.
  primarySoft: string;
  onPrimarySoft: string;
  // Deleting, and going over a target.
  danger: string;
  onDanger: string;
  dangerSoft: string;
  onDangerSoft: string;
  // Chart lines and meter bars, with the track a meter fills.
  mark: string;
  markTrack: string;
  markOver: string;
  markOverTrack: string;
  // Behind a sheet, and the wash a pressed control gets.
  scrim: string;
  pressed: string;
};

// Text and muted text meet WCAG AA (4.5:1) on every background they sit on;
// faint text (placeholders) and icons meet 3:1. The mark colours pass the
// chart palette checks on their own surface.
const light: Palette = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  field: '#EDEFF3',
  border: '#DADEE5',
  text: '#12161C',
  textMuted: '#56606E',
  textFaint: '#737D8B',
  primary: '#1F5FD6',
  onPrimary: '#FFFFFF',
  primarySoft: '#E3ECFC',
  onPrimarySoft: '#12449F',
  danger: '#C02626',
  onDanger: '#FFFFFF',
  dangerSoft: '#FBE9E7',
  onDangerSoft: '#9A1B1B',
  mark: '#1F5FD6',
  markTrack: '#DCE7FB',
  markOver: '#D03B3B',
  markOverTrack: '#F9DCDA',
  scrim: 'rgba(12, 14, 18, 0.5)',
  pressed: 'rgba(18, 22, 28, 0.08)',
};

const dark: Palette = {
  background: '#0C0E12',
  surface: '#171A20',
  field: '#232832',
  border: '#2F3541',
  text: '#F1F3F6',
  textMuted: '#A6AFBC',
  textFaint: '#7C8694',
  primary: '#7EB0FF',
  onPrimary: '#06224F',
  primarySoft: '#1B2F52',
  onPrimarySoft: '#B9D2FF',
  danger: '#FF8B82',
  onDanger: '#4A0B08',
  dangerSoft: '#3B1614',
  onDangerSoft: '#FFB3AC',
  mark: '#4A8FEA',
  markTrack: '#22324F',
  markOver: '#E66767',
  markOverTrack: '#4A2222',
  scrim: 'rgba(0, 0, 0, 0.6)',
  pressed: 'rgba(241, 243, 246, 0.1)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;

// The smallest a control's touch area may be, in each direction.
export const minTouch = 48;

// Text may grow with the phone's font size setting, up to a point where rows
// of numbers still fit.
export const maxFontScale = 1.4;

export const type = StyleSheet.create({
  // One big number, such as the rest countdown.
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
  // The small capitals over a section.
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

export type TextVariant = keyof typeof type;

// Follows the phone's light/dark setting.
export function useAppTheme(): { colors: Palette; dark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? dark : light, dark: isDark };
}

// The same colours for the navigator's own parts: headers and the tab bar.
export function navigationThemeFor(isDark: boolean): Theme {
  const base = isDark ? DarkTheme : DefaultTheme;
  const colors = isDark ? dark : light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
