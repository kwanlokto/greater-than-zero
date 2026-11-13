import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import type { IconName } from '@/components/button';
import { maxFontScale, radius, space, useAppTheme } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  // What the number is in, shown inside the box after it, e.g. "kg".
  suffix?: string;
  // An icon inside the box before the text, e.g. for a search.
  icon?: IconName;
  // Shows a button that empties the box while there's text in it.
  onClear?: () => void;
  align?: 'left' | 'center' | 'right';
  // Heavier text, for a name or a number that matters.
  strong?: boolean;
  // Smaller, for a side note rather than a form's field.
  dense?: boolean;
  // The box itself: its width or how it flexes.
  style?: StyleProp<ViewStyle>;
};

// The app's text box: 52 high, and the whole box takes the tap, including its
// suffix.
export function Input({
  suffix,
  icon,
  onClear,
  align = 'left',
  strong = false,
  dense = false,
  style,
  ...props
}: Props) {
  const { colors } = useAppTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      // The text box inside is what screen readers land on.
      accessible={false}
      onPress={() => input.current?.focus()}
      style={[
        styles.box,
        { backgroundColor: colors.field, borderColor: focused ? colors.primary : colors.border },
        dense && styles.dense,
        props.multiline && styles.multiline,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={20} color={colors.textMuted} />}
      <TextInput
        ref={input}
        maxFontSizeMultiplier={maxFontScale}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        {...props}
        onFocus={event => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          { color: colors.text, textAlign: align },
          strong && styles.strong,
          dense && styles.denseInput,
          props.multiline && styles.multilineInput,
        ]}
      />
      {suffix !== undefined && (
        <Text
          maxFontSizeMultiplier={maxFontScale}
          numberOfLines={1}
          style={[styles.suffix, { color: colors.textMuted }]}
        >
          {suffix}
        </Text>
      )}
      {onClear && !!props.value && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear"
          hitSlop={14}
          onPress={onClear}
        >
          <Ionicons name="close-circle" size={20} color={colors.textFaint} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  dense: {
    minHeight: 44,
  },
  denseInput: {
    fontSize: 15,
  },
  multiline: {
    alignItems: 'flex-start',
    paddingVertical: space.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  multilineInput: {
    minHeight: 24,
    textAlignVertical: 'top',
  },
  strong: {
    fontWeight: '600',
  },
  suffix: {
    fontSize: 14,
    fontWeight: '500',
  },
});
