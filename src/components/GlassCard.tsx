import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { C } from '../theme/colors';

type Props = { children: ReactNode; style?: ViewStyle; highlight?: boolean };

export default function GlassCard({ children, style, highlight }: Props) {
  return (
    <View
      style={[
        s.card,
        highlight && s.highlight,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  highlight: {
    backgroundColor: C.accentMuted,
    borderColor: C.accentSoft,
  },
});
