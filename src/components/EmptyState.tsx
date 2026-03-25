import { StyleSheet, Text, View } from 'react-native';
import { C } from '../theme/colors';

type Props = { title: string; message: string };

export default function EmptyState({ title, message }: Props) {
  return (
    <View style={s.card} accessibilityLabel={`${title}. ${message}`}>
      <Text style={s.title}>{title}</Text>
      <Text style={s.msg}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  title: { color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 6, textAlign: 'center' },
  msg: { color: C.textSubtle, textAlign: 'center', lineHeight: 20 },
});
