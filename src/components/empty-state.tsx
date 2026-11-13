import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button, type IconName } from '@/components/button';
import { space, useAppTheme } from '@/theme';

type Props = {
  icon?: IconName;
  title: string;
  message?: string;
  // The way forward from here, when there is one.
  action?: { label: string; icon?: IconName; onPress: () => void | Promise<void> };
};

// Shown where a list would be while it has nothing in it, or in place of
// something that's gone.
export function EmptyState({ icon, title, message, action }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      {icon && (
        <View style={[styles.icon, { backgroundColor: colors.field }]}>
          <Ionicons name={icon} size={24} color={colors.textMuted} />
        </View>
      )}
      <AppText variant="subheading" style={styles.centred}>
        {title}
      </AppText>
      {message !== undefined && (
        <AppText tone="muted" style={styles.centred}>
          {message}
        </AppText>
      )}
      {action && (
        <Button
          variant="tonal"
          label={action.label}
          icon={action.icon}
          onPress={action.onPress}
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  centred: {
    textAlign: 'center',
  },
  action: {
    marginTop: space.sm,
    alignSelf: 'center',
  },
});
