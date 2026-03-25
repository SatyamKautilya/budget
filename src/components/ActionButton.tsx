import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { C } from '../theme/colors';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

export default function ActionButton({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const bg =
    variant === 'primary'
      ? s.primary
      : variant === 'danger'
        ? s.danger
        : s.outline;

  return (
    <Pressable
      style={[s.base, bg, disabled && s.disabled, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[s.text, variant === 'outline' && s.outlineText, variant === 'danger' && s.dangerText]}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: { borderRadius: 12, alignItems: 'center', paddingVertical: 13, marginTop: 6 },
  primary: { backgroundColor: C.accent },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.accent,
  },
  danger: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.red,
  },
  disabled: { opacity: 0.5 },
  text: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  outlineText: { color: C.accent },
  dangerText: { color: C.red },
});
