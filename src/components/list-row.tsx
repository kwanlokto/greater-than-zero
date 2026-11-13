import Ionicons from '@expo/vector-icons/Ionicons';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import type { IconName } from '@/components/button';
import { radius, space, useAppTheme } from '@/theme';
import { useGuardedPress } from '@/use-guarded-press';

type RowProps = {
  title: string;
  subtitle?: string;
  subtitleLines?: number;
  // An icon in a tinted circle before the text.
  icon?: IconName;
  // Text at the far end, such as a value or a state.
  value?: string;
  valueTone?: 'muted' | 'primary';
  // The icon at the far end; a chevron when the row opens something.
  trailingIcon?: IconName;
  trailingIconTone?: 'muted' | 'primary';
  // Anything else at the far end, in place of the icon.
  trailing?: ReactNode;
  onPress?: () => void | Promise<void>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

// One line of a list: at least 60 high, so it's easy to hit. With onPress the
// whole row is the button, and a second tap while it works is ignored.
export function ListRow({
  title,
  subtitle,
  subtitleLines = 2,
  icon,
  value,
  valueTone = 'muted',
  trailingIcon,
  trailingIconTone = 'muted',
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: RowProps) {
  const { colors } = useAppTheme();
  const { press, busy } = useGuardedPress(async () => {
    await onPress?.();
  });
  const endIcon = trailingIcon ?? (onPress ? 'chevron-forward' : undefined);

  const content = (
    <>
      {icon && (
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={20} color={colors.onPrimarySoft} />
        </View>
      )}
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle !== undefined && (
          <AppText variant="caption" tone="muted" numberOfLines={subtitleLines}>
            {subtitle}
          </AppText>
        )}
      </View>
      {value !== undefined && (
        <AppText variant="label" tone={valueTone}>
          {value}
        </AppText>
      )}
      {trailing ??
        (endIcon && (
          <Ionicons
            name={endIcon}
            size={20}
            color={trailingIconTone === 'primary' ? colors.primary : colors.textFaint}
          />
        ))}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, { backgroundColor: colors.surface }]}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={press}
      android_ripple={{ color: colors.pressed }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface },
        (pressed || busy) && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

// A hairline between rows, starting where their text does.
export function Divider() {
  const { colors } = useAppTheme();
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
    </View>
  );
}

type GroupProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Rows gathered into one rounded panel, with hairlines between them.
export function ListGroup({ children, style }: GroupProps) {
  const { colors } = useAppTheme();
  const rows = Children.toArray(children);

  return (
    <View
      style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 && <Divider />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space.lg,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
