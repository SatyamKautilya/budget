import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { C } from '../theme/colors';

type Props = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
};

export default function FormInput({ label, placeholder, value, onChangeText, keyboardType }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        accessibilityLabel={label}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 6 },
  label: { color: C.textSubtle, fontWeight: '600', marginBottom: 5, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.inputBg,
    color: C.text,
    fontSize: 14,
  },
});
