import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import type { IconName } from '@/components/button';
import { radius, space, useAppTheme } from '@/theme';

export type SheetAction = {
  label: string;
  icon: IconName;
  // In the warning colour, for actions like removing.
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
};

// A menu that slides up from the bottom of the screen, within reach of a thumb.
// Tapping outside it, or the back button, closes it.
export function ActionSheet({ visible, title, actions, onClose }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={[styles.scrim, { backgroundColor: colors.scrim }]}
      >
        {/* Its own Pressable, so a tap on the sheet doesn't close it. */}
        <Pressable
          accessible={false}
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: space.md + insets.bottom },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <AppText accessibilityRole="header" variant="subheading" style={styles.title}>
            {title}
          </AppText>
          {actions.map(action => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              android_ripple={{ color: colors.pressed }}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons
                name={action.icon}
                size={22}
                color={action.destructive ? colors.danger : colors.text}
              />
              <AppText variant="bodyStrong" tone={action.destructive ? 'danger' : 'default'}>
                {action.label}
              </AppText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingTop: space.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: space.sm,
  },
  title: {
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: 56,
    paddingHorizontal: space.xl,
  },
  pressed: {
    opacity: 0.6,
  },
});
