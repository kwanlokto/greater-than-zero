import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { space } from '@/theme';

type Props = {
  label: string;
  // A line of help under it.
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// A labelled part of a form, e.g. "Name" over its text box.
export function Field({ label, hint, children, style }: Props) {
  return (
    <View style={[styles.field, style]}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      {children}
      {hint !== undefined && (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.sm,
  },
});
