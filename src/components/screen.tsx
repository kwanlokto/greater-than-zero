import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fabClearance } from '@/components/fab';
import { space, useAppTheme } from '@/theme';

type Props = {
  children: ReactNode;
  // On a tab, the tab bar already keeps content clear of the system bar.
  onTab?: boolean;
  // Stays at the bottom of the screen, above the system bar: the place for
  // the screen's main action, where a thumb reaches it.
  footer?: ReactNode;
  // The screen's floating add button. The content leaves room for it at the
  // end, so the last of it can scroll clear.
  fab?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

// The space to leave at the bottom of a screen that isn't on a tab, so
// nothing sits under Android's navigation bar.
export function useBottomInset(onTab = false): number {
  const insets = useSafeAreaInsets();
  return onTab ? 0 : insets.bottom;
}

// A screen's frame: the background, even padding, content that scrolls and
// stays clear of the system bar, and an optional footer for the main action.
export function Screen({ children, onTab = false, footer, fab, contentStyle }: Props) {
  const { colors } = useAppTheme();
  const bottomInset = useBottomInset(onTab);
  // The footer keeps itself clear of the system bar; content above it needn't.
  const bottomSpace = (fab ? fabClearance : space.xl) + (footer ? 0 : bottomInset);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, contentStyle, { paddingBottom: bottomSpace }]}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: space.md + bottomInset,
            },
          ]}
        >
          {footer}
        </View>
      )}
      {fab}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.lg,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
