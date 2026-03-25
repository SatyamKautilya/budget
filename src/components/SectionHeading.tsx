import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';

type Props = { title: string; subtitle?: string };

export default function SectionHeading({ title, subtitle }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  subtitle: { marginTop: 4, color: C.textSubtle, fontSize: 13 },
});
