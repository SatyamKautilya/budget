import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Loan } from '../../types';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import { calculateLoanStats, buildProjection } from './loanMath';
import GlassCard from '../../components/GlassCard';
import MetricBox from '../../components/MetricBox';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';

type Props = { loans: Loan[] };

export default function LoansSection({ loans }: Props) {
  const stats = useMemo(() => loans.map(calculateLoanStats), [loans]);
  const projection = useMemo(() => buildProjection(loans), [loans]);

  const totals = useMemo(
    () =>
      stats.reduce(
        (a, l) => ({
          principal: a.principal + l.amount,
          emi: a.emi + l.emi,
          payable: a.payable + l.totalPayable,
          outstanding: a.outstanding + l.outstanding,
          paidPrincipal: a.paidPrincipal + l.paidPrincipal,
          paidInterest: a.paidInterest + l.paidInterest,
        }),
        { principal: 0, emi: 0, payable: 0, outstanding: 0, paidPrincipal: 0, paidInterest: 0 }
      ),
    [stats]
  );

  const paidFrac = totals.principal > 0 ? totals.paidPrincipal / totals.principal : 0;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const paidArc = circumference * paidFrac;

  return (
    <>
      <GlassCard>
        <View style={s.pieRow}>
          <Svg width={130} height={130}>
            <Circle cx={65} cy={65} r={radius} stroke={C.purpleSoft} strokeWidth={14} fill="transparent" />
            <Circle
              cx={65}
              cy={65}
              r={radius}
              stroke={C.cyan}
              strokeWidth={14}
              fill="transparent"
              strokeDasharray={`${paidArc} ${circumference - paidArc}`}
              transform="rotate(-90 65 65)"
              strokeLinecap="round"
            />
          </Svg>
          <View style={s.legendCol}>
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: C.cyan }]} />
              <View>
                <Text style={s.legendLabel}>Paid</Text>
                <Text style={s.legendValue}>{formatCurrency(totals.paidPrincipal)}</Text>
              </View>
            </View>
            <View style={s.legendItem}>
              <View style={[s.dot, { backgroundColor: C.purple }]} />
              <View>
                <Text style={s.legendLabel}>Remaining</Text>
                <Text style={s.legendValue}>{formatCurrency(totals.outstanding)}</Text>
              </View>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={s.cardTitle}>Dashboard</Text>
        <View style={s.row}>
          <MetricBox label="Active" value={String(stats.length)} />
          <MetricBox label="Monthly EMI" value={formatCurrency(totals.emi)} />
        </View>
        <View style={s.row}>
          <MetricBox label="Principal" value={formatCurrency(totals.principal)} />
          <MetricBox label="Total Payable" value={formatCurrency(totals.payable)} />
        </View>
        <View style={s.row}>
          <MetricBox label="Outstanding" value={formatCurrency(totals.outstanding)} />
          <MetricBox label="Paid Interest" value={formatCurrency(totals.paidInterest)} />
        </View>
      </GlassCard>

      {projection.length > 0 ? (
        <GlassCard>
          <Text style={s.cardTitle}>EMI Projection</Text>
          {projection.map((m) => (
            <View key={m.label} style={s.projRow}>
              <Text style={s.projMonth}>{m.label}</Text>
              <View style={s.projDetails}>
                <Text style={s.projVal}>EMI {formatCurrency(m.emi)}</Text>
                <Text style={s.projSub}>P: {formatCurrency(m.principal)}  I: {formatCurrency(m.interest)}</Text>
              </View>
            </View>
          ))}
        </GlassCard>
      ) : null}

      <SectionHeading title="Your Loans" />

      {stats.length === 0 ? (
        <EmptyState title="No loans yet" message="Add your first loan to start tracking EMI repayments." />
      ) : (
        stats.map((loan, i) => (
          <GlassCard key={loan.id}>
            <View style={s.loanHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.loanTitle}>{loan.title}</Text>
                <Text style={s.loanSub}>Loan #{stats.length - i}</Text>
              </View>
              <View style={s.badge}>
                <Text style={s.badgeText}>Active</Text>
              </View>
            </View>

            <View style={s.pillRow}>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Outstanding</Text>
                <Text style={s.pillVal}>{formatCurrency(loan.outstanding)}</Text>
              </View>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Paid</Text>
                <Text style={s.pillVal}>{formatCurrency(loan.paidAmount)}</Text>
              </View>
              <View style={s.pill}>
                <Text style={s.pillLabel}>Interest</Text>
                <Text style={s.pillVal}>{formatCurrency(loan.paidInterest)}</Text>
              </View>
            </View>

            <View style={s.track}>
              <View style={[s.fill, { width: `${loan.progressPercent}%` }]} />
            </View>
            <Text style={s.progressLabel}>
              {loan.progressPercent.toFixed(1)}% repaid  ·  {loan.paidMonths}/{loan.tenureMonths} EMIs
            </Text>

            <View style={s.detailGrid}>
              {[
                ['Amount', formatCurrency(loan.amount)],
                ['1st EMI', loan.firstEmiDate],
                ['Tenure', `${loan.tenureMonths} mo`],
                ['Rate', `${loan.interestRate}%`],
                ['EMI', formatCurrency(loan.emi)],
              ].map(([k, v]) => (
                <View key={k} style={s.detailItem}>
                  <Text style={s.detailLabel}>{k}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        ))
      )}
    </>
  );
}

const s = StyleSheet.create({
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendCol: { flex: 1, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: C.textSubtle, fontSize: 12 },
  legendValue: { color: C.text, fontWeight: '700', marginTop: 2 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  projRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 10,
    marginBottom: 8,
  },
  projMonth: { color: C.accent, fontWeight: '700', width: 70 },
  projDetails: { flex: 1 },
  projVal: { color: C.text, fontWeight: '600', fontSize: 13 },
  projSub: { color: C.textSubtle, fontSize: 11, marginTop: 2 },
  loanHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  loanTitle: { color: C.text, fontWeight: '700', fontSize: 16 },
  loanSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: C.greenSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: C.green, fontSize: 12, fontWeight: '700' },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    padding: 8,
  },
  pillLabel: { color: C.textSubtle, fontSize: 11 },
  pillVal: { color: C.text, fontWeight: '700', fontSize: 12, marginTop: 4 },
  track: { height: 8, borderRadius: 99, backgroundColor: C.borderLight, overflow: 'hidden', marginBottom: 6 },
  fill: { height: '100%', backgroundColor: C.cyan, borderRadius: 99 },
  progressLabel: { color: C.textSubtle, fontSize: 12, marginBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailItem: {
    width: '47%',
    backgroundColor: C.inputBg,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  detailLabel: { color: C.textMuted, fontSize: 11 },
  detailValue: { color: C.text, fontWeight: '600', marginTop: 2 },
});
