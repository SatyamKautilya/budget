import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Income } from '../../types';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import MetricBox from '../../components/MetricBox';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';

type Props = { incomes: Income[] };

export default function IncomeSection({ incomes }: Props) {
  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes]);

  return (
    <>
      <GlassCard>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
          Income Dashboard
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MetricBox label="Total Entries" value={String(incomes.length)} />
          <MetricBox label="Total Income" value={formatCurrency(totalIncome)} />
        </View>
      </GlassCard>

      <SectionHeading title="Your Income" />

      {incomes.length === 0 ? (
        <EmptyState title="No income yet" message="Add income entries to track your earnings." />
      ) : (
        incomes.map((income) => (
          <GlassCard key={income.id}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{income.title}</Text>
            <Text style={{ color: C.green, marginTop: 6, fontWeight: '700' }}>
              {formatCurrency(income.amount)}
            </Text>
          </GlassCard>
        ))
      )}
    </>
  );
}
