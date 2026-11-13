import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button, type IconName } from '@/components/button';
import { space } from '@/theme';

type Props = {
  title: string;
  // A link beside the title, e.g. to manage what the section lists.
  action?: { label: string; icon?: IconName; onPress: () => void | Promise<void> };
  children: ReactNode;
};

// A titled part of a screen.
export function Section({ title, action, children }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="overline" tone="muted" style={styles.title}>
          {title}
        </AppText>
        {action && (
          <Button
            variant="ghost"
            size="small"
            label={action.label}
            icon={action.icon}
            onPress={action.onPress}
            // Drawn 28 high to sit beside the title; touched like 48.
            hitSlop={10}
            style={styles.action}
          />
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
    paddingHorizontal: space.xs,
  },
  title: {
    flex: 1,
  },
  action: {
    minHeight: 28,
    paddingHorizontal: space.sm,
    marginRight: -space.sm,
  },
});
