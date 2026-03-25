import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';

type Props = { label: string; value: string };

export default function MetricBox({ label, value }: Props) {
  return (
    <View style={s.box} accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  label: { color: C.textSubtle, fontSize: 12 },
  value: { color: C.text, fontWeight: '700', marginTop: 6, fontSize: 13 },
});
