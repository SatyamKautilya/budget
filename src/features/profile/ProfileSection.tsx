import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Loan, Asset, Income } from '../../types';
import { Transaction, TransactionCategory } from '../transactions/types';
import { calculateLoanStats } from '../loans/loanMath';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import SectionHeading from '../../components/SectionHeading';

type Props = {
  loans: Loan[];
  assets: Asset[];
  incomes: Income[];
  transactions: Transaction[];
  categories: TransactionCategory[];
};

const PIE_COLORS = {
  assets: '#4ade80',
  loans: '#f87171',
  income: '#38bdf8',
  credit: '#4ade80',
  debit: '#f87171',
};

function slicePath(cx: number, cy: number, r: number, startRad: number, endRad: number) {
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const large = endRad - startRad > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export default function ProfileSection({ loans, assets, incomes, transactions, categories }: Props) {
  const loanStats = useMemo(() => loans.map(calculateLoanStats), [loans]);

  const totalOutstanding = useMemo(
    () => loanStats.reduce((s, l) => s + l.outstanding, 0),
    [loanStats]
  );
  const totalEmi = useMemo(() => loans.reduce((s, l) => s + l.emi, 0), [loans]);
  const totalLoanPrincipal = useMemo(() => loans.reduce((s, l) => s + l.amount, 0), [loans]);
  const totalPaidOnLoans = useMemo(
    () => loanStats.reduce((s, l) => s + l.paidAmount, 0),
    [loanStats]
  );

  const totalAssetValue = useMemo(() => assets.reduce((s, a) => s + a.price, 0), [assets]);
  const totalIncomeRecorded = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes]);

  const txTotals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    transactions.forEach((t) => {
      if (t.type === 'credit') credit += t.amount;
      else debit += t.amount;
    });
    return { credit, debit, net: credit - debit, count: transactions.length };
  }, [transactions]);

  const netWorth = totalAssetValue - totalOutstanding;

  const pieSlices = useMemo(() => {
    const a = totalAssetValue;
    const b = totalOutstanding;
    const inc = totalIncomeRecorded;
    const sum = a + b + inc;
    if (sum <= 0) return null;
    const parts = [
      { key: 'assets', value: a, color: PIE_COLORS.assets, label: 'Assets' },
      { key: 'loans', value: b, color: PIE_COLORS.loans, label: 'Loan balance' },
      { key: 'income', value: inc, color: PIE_COLORS.income, label: 'Income (recorded)' },
    ].filter((p) => p.value > 0);

    let angle = -Math.PI / 2;
    const paths: { d: string; color: string; label: string; pct: number }[] = [];
    parts.forEach((p) => {
      const frac = p.value / sum;
      const sweep = frac * 2 * Math.PI;
      const end = angle + sweep;
      paths.push({
        d: slicePath(100, 100, 88, angle, end),
        color: p.color,
        label: p.label,
        pct: frac * 100,
      });
      angle = end;
    });
    return paths;
  }, [totalAssetValue, totalOutstanding, totalIncomeRecorded]);

  const barMetrics = useMemo(() => {
    const items = [
      { label: 'Assets', value: totalAssetValue, color: PIE_COLORS.assets },
      { label: 'Loan outstanding', value: totalOutstanding, color: PIE_COLORS.loans },
      { label: 'Income (total)', value: totalIncomeRecorded, color: PIE_COLORS.income },
      { label: 'Net worth', value: netWorth, color: netWorth >= 0 ? C.cyan : C.red },
    ];
    const maxVal = Math.max(...items.map((i) => Math.abs(i.value)), 1);
    return items.map((i) => ({
      ...i,
      widthPct: (Math.abs(i.value) / maxVal) * 100,
    }));
  }, [totalAssetValue, totalOutstanding, totalIncomeRecorded, netWorth]);

  const flowPct = useMemo(() => {
    const t = txTotals.credit + txTotals.debit;
    if (t <= 0) return { creditPct: 50, debitPct: 50 };
    return {
      creditPct: (txTotals.credit / t) * 100,
      debitPct: (txTotals.debit / t) * 100,
    };
  }, [txTotals]);

  const debitByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type !== 'debit' || !t.categoryId) return;
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount;
    });
    return categories
      .map((c) => ({ name: c.name, amount: map[c.id] ?? 0 }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions, categories]);

  const catSpendTotal = debitByCategory.reduce((s, x) => s + x.amount, 0);

  return (
    <>
      <GlassCard highlight>
        <Text style={s.heroLabel}>Estimated net position</Text>
        <Text style={[s.heroValue, netWorth < 0 && s.heroNeg]}>{formatCurrency(netWorth)}</Text>
        <Text style={s.heroHint}>Assets minus loan principal still owed</Text>
      </GlassCard>

      <SectionHeading title="Balance snapshot" subtitle="How your major totals compare" />

      <GlassCard>
        <Text style={s.cardTitle}>Relative scale</Text>
        <View style={{ marginTop: 8 }}>
          {barMetrics.map((row) => (
            <View key={row.label} style={s.barRow}>
              <Text style={s.barLabel}>{row.label}</Text>
              <Text style={s.barVal}>{formatCurrency(row.value)}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFillInner, { width: `${row.widthPct}%`, backgroundColor: row.color }]} />
              </View>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={s.cardTitle}>Composition</Text>
        <Text style={s.cardSub}>Assets · loan balance · recorded income (by size)</Text>
        {pieSlices && pieSlices.length > 0 ? (
          <View style={s.pieRow}>
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Circle cx={100} cy={100} r={40} fill="rgba(15,23,42,0.5)" />
              {pieSlices.map((p, i) => (
                <Path key={i} d={p.d} fill={p.color} opacity={0.92} />
              ))}
              <Circle cx={100} cy={100} r={48} fill={C.bg} />
              <Circle cx={100} cy={100} r={44} fill="transparent" stroke={C.cardBorder} strokeWidth={1} />
            </Svg>
            <View style={s.legend}>
              {pieSlices.map((p, i) => (
                <View key={i} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: p.color }]} />
                  <Text style={s.legendText}>{p.label}</Text>
                  <Text style={s.legendPct}>{p.pct.toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={s.emptyPie}>Add assets, loans, or income to see the chart.</Text>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={s.cardTitle}>Loans</Text>
        <View style={s.statGrid}>
          <View style={s.statCell}>
            <Text style={s.statVal}>{loans.length}</Text>
            <Text style={s.statLab}>Active loans</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{formatCurrency(totalEmi)}</Text>
            <Text style={s.statLab}>Monthly EMI</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{formatCurrency(totalOutstanding)}</Text>
            <Text style={s.statLab}>Outstanding</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{formatCurrency(totalPaidOnLoans)}</Text>
            <Text style={s.statLab}>Repaid so far</Text>
          </View>
        </View>
        {totalLoanPrincipal > 0 ? (
          <View style={s.loanRingWrap}>
            <Svg width={160} height={160}>
              {(() => {
                const cx = 80;
                const cy = 80;
                const r = 56;
                const sw = 12;
                const c = 2 * Math.PI * r;
                const denom = totalPaidOnLoans + totalOutstanding;
                const paidFrac = denom > 0 ? Math.min(1, totalPaidOnLoans / denom) : 0;
                const arc = c * paidFrac;
                return (
                  <>
                    <Circle cx={cx} cy={cy} r={r} stroke={C.purpleSoft} strokeWidth={sw} fill="none" />
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      stroke={C.cyan}
                      strokeWidth={sw}
                      fill="none"
                      strokeDasharray={`${arc} ${c - arc}`}
                      transform={`rotate(-90 ${cx} ${cy})`}
                      strokeLinecap="round"
                    />
                  </>
                );
              })()}
            </Svg>
            <Text style={s.loanRingPct}>
              {totalLoanPrincipal > 0
                ? ((totalPaidOnLoans / (totalPaidOnLoans + totalOutstanding || 1)) * 100).toFixed(0)
                : '0'}
              %
            </Text>
            <Text style={s.loanRingSub}>of obligation repaid</Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard>
        <Text style={s.cardTitle}>Wealth</Text>
        <View style={s.statGrid}>
          <View style={s.statCell}>
            <Text style={s.statVal}>{assets.length}</Text>
            <Text style={s.statLab}>Asset entries</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statVal, { color: PIE_COLORS.assets }]}>{formatCurrency(totalAssetValue)}</Text>
            <Text style={s.statLab}>Total value</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statVal, { color: PIE_COLORS.income }]}>{formatCurrency(totalIncomeRecorded)}</Text>
            <Text style={s.statLab}>Income recorded</Text>
          </View>
          <View style={s.statCell}>
            <Text style={s.statVal}>{incomes.length}</Text>
            <Text style={s.statLab}>Income lines</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={s.cardTitle}>Transactions</Text>
        <Text style={s.cardSub}>All-time credit vs debit volume</Text>
        <View style={s.flowBar}>
          <View style={[s.flowSeg, { flex: Math.max(txTotals.credit, 1), backgroundColor: PIE_COLORS.credit }]}>
            <Text style={s.flowSegText}>Cr</Text>
          </View>
          <View style={[s.flowSeg, { flex: Math.max(txTotals.debit, 1), backgroundColor: PIE_COLORS.debit }]}>
            <Text style={s.flowSegText}>Dr</Text>
          </View>
        </View>
        <View style={s.txRow}>
          <Text style={s.txItem}>Credit {formatCurrency(txTotals.credit)}</Text>
          <Text style={s.txItem}>Debit {formatCurrency(txTotals.debit)}</Text>
        </View>
        <Text style={s.netLine}>
          Net flow: <Text style={txTotals.net >= 0 ? s.netPos : s.netNeg}>{formatCurrency(txTotals.net)}</Text>
          {' · '}
          {txTotals.count} entries
        </Text>

        {debitByCategory.length > 0 && catSpendTotal > 0 ? (
          <>
            <Text style={[s.cardTitle, { marginTop: 16 }]}>Spending by category (debit)</Text>
            {debitByCategory.map((row) => (
              <View key={row.name} style={s.catSpendRow}>
                <Text style={s.catSpendName}>{row.name}</Text>
                <View style={s.catSpendTrack}>
                  <View
                    style={[
                      s.catSpendFill,
                      { width: `${(row.amount / catSpendTotal) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={s.catSpendAmt}>{formatCurrency(row.amount)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </GlassCard>
    </>
  );
}

const s = StyleSheet.create({
  heroLabel: { color: C.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  heroValue: { color: C.text, fontSize: 32, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  heroNeg: { color: C.red },
  heroHint: { color: C.textSubtle, fontSize: 12, marginTop: 8 },

  cardTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  cardSub: { color: C.textMuted, fontSize: 11, marginTop: 4, marginBottom: 4 },

  barRow: { marginBottom: 14 },
  barLabel: { color: C.textSubtle, fontSize: 11, marginBottom: 4 },
  barVal: { color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  barTrack: { height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: C.borderLight },
  barFillInner: { height: 10, borderRadius: 5, minWidth: 2 },

  pieRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  legend: { flex: 1, minWidth: 140, marginLeft: 8, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: C.textSubtle, fontSize: 12, flex: 1 },
  legendPct: { color: C.text, fontWeight: '700', fontSize: 12 },
  emptyPie: { color: C.textMuted, fontSize: 13, marginTop: 8 },

  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12,
  },
  statCell: {
    width: '47%',
    backgroundColor: C.inputBg,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  statVal: { color: C.text, fontWeight: '800', fontSize: 14 },
  statLab: { color: C.textMuted, fontSize: 10, marginTop: 4 },

  loanRingWrap: { alignItems: 'center', marginTop: 12 },
  loanRingPct: { color: C.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  loanRingSub: { color: C.textMuted, fontSize: 10, marginTop: 2 },

  flowBar: {
    flexDirection: 'row', height: 36, borderRadius: 10, overflow: 'hidden', marginTop: 10,
  },
  flowSeg: { justifyContent: 'center', alignItems: 'center', minWidth: 8 },
  flowSegText: { color: '#0f172a', fontWeight: '800', fontSize: 11 },

  txRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  txItem: { color: C.textSubtle, fontSize: 12 },
  netLine: { color: C.textMuted, fontSize: 12, marginTop: 8 },
  netPos: { color: C.green, fontWeight: '700' },
  netNeg: { color: C.red, fontWeight: '700' },

  catSpendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  catSpendName: { width: 90, color: C.textSubtle, fontSize: 11 },
  catSpendTrack: {
    flex: 1, height: 6, backgroundColor: C.borderLight, borderRadius: 3, overflow: 'hidden',
  },
  catSpendFill: { height: 6, backgroundColor: C.accent, borderRadius: 3, opacity: 0.9 },
  catSpendAmt: { width: 88, textAlign: 'right', color: C.text, fontWeight: '700', fontSize: 11 },
});
