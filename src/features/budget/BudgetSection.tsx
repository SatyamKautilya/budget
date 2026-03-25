import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BudgetAllocation, BudgetData } from '../../types';
import { TransactionCategory } from '../transactions/types';
import { Transaction } from '../transactions/types';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import MetricBox from '../../components/MetricBox';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';
import ActionButton from '../../components/ActionButton';

type Props = {
  budgetData: BudgetData;
  categories: TransactionCategory[];
  transactions: Transaction[];
  onUpdateDefault: (budget: BudgetAllocation) => void;
  onUpdateMonthly: (monthKey: string, budget: BudgetAllocation) => void;
  onClearMonthly: (monthKey: string) => void;
};

type EditMode = 'default' | 'month';

const mkKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const mkLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const utilizationColor = (pct: number, hasBudget: boolean): string => {
  if (!hasBudget) return C.card;
  if (pct <= 50) return 'rgba(74,222,128,0.10)';
  if (pct <= 75) return 'rgba(74,222,128,0.18)';
  if (pct <= 90) return 'rgba(250,204,21,0.16)';
  if (pct <= 100) return 'rgba(251,146,60,0.18)';
  return 'rgba(248,113,113,0.22)';
};

const utilizationBorder = (pct: number, hasBudget: boolean): string => {
  if (!hasBudget) return C.cardBorder;
  if (pct <= 50) return 'rgba(74,222,128,0.25)';
  if (pct <= 75) return 'rgba(74,222,128,0.35)';
  if (pct <= 90) return 'rgba(250,204,21,0.35)';
  if (pct <= 100) return 'rgba(251,146,60,0.4)';
  return 'rgba(248,113,113,0.5)';
};

const utilizationLabel = (pct: number, hasBudget: boolean): string => {
  if (!hasBudget) return '';
  if (pct === 0) return 'Unused';
  if (pct <= 50) return 'Low';
  if (pct <= 75) return 'Moderate';
  if (pct <= 90) return 'High';
  if (pct <= 100) return 'Almost Full';
  return 'Over Budget!';
};

export default function BudgetSection({
  budgetData,
  categories,
  transactions,
  onUpdateDefault,
  onUpdateMonthly,
  onClearMonthly,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => mkKey(new Date()));
  const [editMode, setEditMode] = useState<EditMode>('month');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const hasMonthOverride = Boolean(budgetData.monthlyBudgets[selectedMonth]);

  const effectiveBudget: BudgetAllocation = useMemo(() => {
    return budgetData.monthlyBudgets[selectedMonth] ?? budgetData.defaultBudget;
  }, [budgetData, selectedMonth]);

  const totalBudget = useMemo(
    () => Object.values(effectiveBudget).reduce((s, v) => s + v, 0),
    [effectiveBudget]
  );

  const monthSpending = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (t.type !== 'debit' || !t.categoryId || !t.createdAt) return;
      if (mkKey(new Date(t.createdAt)) !== selectedMonth) return;
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount;
    });
    return map;
  }, [transactions, selectedMonth]);

  const totalSpent = useMemo(
    () => Object.values(monthSpending).reduce((s, v) => s + v, 0),
    [monthSpending]
  );

  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(mkKey(new Date()));
    const now = new Date();
    for (let i = 1; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(mkKey(d));
    }
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(mkKey(d));
    }
    Object.keys(budgetData.monthlyBudgets).forEach((k) => set.add(k));
    return Array.from(set).sort().reverse();
  }, [budgetData.monthlyBudgets]);

  const canGoBack = availableMonths.indexOf(selectedMonth) < availableMonths.length - 1;
  const canGoForward = availableMonths.indexOf(selectedMonth) > 0;

  const navigateMonth = (dir: -1 | 1) => {
    const idx = availableMonths.indexOf(selectedMonth);
    const next = idx - dir;
    if (next >= 0 && next < availableMonths.length) {
      setSelectedMonth(availableMonths[next]);
      setEditing(false);
    }
  };

  const startEditing = (mode: EditMode) => {
    setEditMode(mode);
    const source = mode === 'default' ? budgetData.defaultBudget : effectiveBudget;
    const d: Record<string, string> = {};
    categories.forEach((c) => {
      const val = source[c.id];
      d[c.id] = val ? String(val) : '';
    });
    setDraft(d);
    setEditing(true);
  };

  const saveBudget = () => {
    const alloc: BudgetAllocation = {};
    categories.forEach((c) => {
      const v = Number(draft[c.id]);
      if (Number.isFinite(v) && v > 0) alloc[c.id] = v;
    });
    if (editMode === 'default') onUpdateDefault(alloc);
    else onUpdateMonthly(selectedMonth, alloc);
    setEditing(false);
  };

  return (
    <>
      {/* Month Navigator */}
      <GlassCard>
        <View style={s.monthNav}>
          <Pressable
            style={[s.navArrow, !canGoBack && s.navDisabled]}
            onPress={() => navigateMonth(-1)}
            disabled={!canGoBack}
            accessibilityLabel="Previous month"
          >
            <Text style={[s.navArrowText, !canGoBack && s.navArrowDisabled]}>{'<'}</Text>
          </Pressable>
          <View style={s.monthCenter}>
            <Text style={s.monthTitle}>{mkLabel(selectedMonth)}</Text>
            <Text style={s.monthTag}>
              {hasMonthOverride ? 'Custom Budget' : 'Using Default'}
            </Text>
          </View>
          <Pressable
            style={[s.navArrow, !canGoForward && s.navDisabled]}
            onPress={() => navigateMonth(1)}
            disabled={!canGoForward}
            accessibilityLabel="Next month"
          >
            <Text style={[s.navArrowText, !canGoForward && s.navArrowDisabled]}>{'>'}</Text>
          </Pressable>
        </View>
      </GlassCard>

      {/* Overall Summary — tinted by overall utilization */}
      <View
        style={[
          s.utilCard,
          {
            backgroundColor: utilizationColor(overallPct, totalBudget > 0),
            borderColor: utilizationBorder(overallPct, totalBudget > 0),
          },
        ]}
      >
        <View style={s.overviewHeader}>
          <Text style={s.heading}>Budget Overview</Text>
          {totalBudget > 0 ? (
            <View style={[s.utilBadge, { backgroundColor: utilizationBorder(overallPct, true) }]}>
              <Text style={s.utilBadgeText}>
                {overallPct.toFixed(0)}% used · {utilizationLabel(overallPct, true)}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={s.metricsRow}>
          <MetricBox label="Budget" value={formatCurrency(totalBudget)} />
          <MetricBox label="Spent" value={formatCurrency(totalSpent)} />
          <MetricBox label="Remaining" value={formatCurrency(totalBudget - totalSpent)} />
        </View>
        {totalBudget > 0 ? (
          <View style={s.barTrack}>
            <View
              style={[
                s.barFill,
                {
                  width: `${Math.min(100, overallPct)}%`,
                  backgroundColor: overallPct > 100 ? C.red : overallPct > 90 ? '#fb923c' : overallPct > 75 ? '#facc15' : C.green,
                },
              ]}
            />
          </View>
        ) : null}
        {totalSpent > totalBudget && totalBudget > 0 ? (
          <Text style={s.overBudget}>Over budget by {formatCurrency(totalSpent - totalBudget)}</Text>
        ) : null}
      </View>

      {/* Category-wise breakdown */}
      <SectionHeading title="Category Breakdown" />
      {categories.length === 0 ? (
        <EmptyState title="No categories" message="Add categories in the Transactions section first." />
      ) : (
        categories.map((cat) => {
          const allocated = effectiveBudget[cat.id] ?? 0;
          const spent = monthSpending[cat.id] ?? 0;
          const remaining = allocated - spent;
          const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
          const clampedPct = Math.min(100, pct);
          const over = spent > allocated && allocated > 0;
          const hasBudget = allocated > 0;
          const tag = utilizationLabel(pct, hasBudget);

          return (
            <View
              key={cat.id}
              style={[
                s.utilCard,
                {
                  backgroundColor: utilizationColor(pct, hasBudget),
                  borderColor: utilizationBorder(pct, hasBudget),
                },
              ]}
            >
              {/* Utilization fill bar behind content */}
              {hasBudget ? (
                <View style={s.fillTrack}>
                  <View
                    style={[
                      s.fillBar,
                      {
                        width: `${clampedPct}%`,
                        backgroundColor: over ? 'rgba(248,113,113,0.12)' : pct > 75 ? 'rgba(250,204,21,0.08)' : 'rgba(74,222,128,0.08)',
                      },
                    ]}
                  />
                </View>
              ) : null}

              <View style={s.catRow}>
                <Text style={s.catName}>{cat.name}</Text>
                {hasBudget ? (
                  <View style={s.catBadgeRow}>
                    <Text style={[s.catPct, over && s.catPctOver]}>{pct.toFixed(0)}%</Text>
                    {tag ? (
                      <View style={[s.tagPill, { backgroundColor: utilizationBorder(pct, true) }]}>
                        <Text style={s.tagText}>{tag}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={s.noBudget}>No budget set</Text>
                )}
              </View>

              <View style={s.catMetrics}>
                <View style={s.catMetricItem}>
                  <Text style={s.catMetricLabel}>Budget</Text>
                  <Text style={s.catMetricVal}>{hasBudget ? formatCurrency(allocated) : '—'}</Text>
                </View>
                <View style={s.catMetricItem}>
                  <Text style={s.catMetricLabel}>Spent</Text>
                  <Text style={s.catMetricVal}>{formatCurrency(spent)}</Text>
                </View>
                <View style={s.catMetricItem}>
                  <Text style={s.catMetricLabel}>Left</Text>
                  <Text style={[s.catMetricVal, over && s.overText]}>
                    {hasBudget ? formatCurrency(remaining) : '—'}
                  </Text>
                </View>
              </View>

              {hasBudget ? (
                <View style={s.catBar}>
                  <View
                    style={[
                      s.catBarFill,
                      {
                        width: `${clampedPct}%`,
                        backgroundColor: over ? C.red : pct > 90 ? '#fb923c' : pct > 75 ? '#facc15' : C.green,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* Edit buttons */}
      {!editing ? (
        <GlassCard>
          <Text style={s.heading}>Manage Budget</Text>
          <ActionButton
            label={`Edit ${mkLabel(selectedMonth)} Budget`}
            onPress={() => startEditing('month')}
          />
          <ActionButton
            label="Edit Default Budget"
            onPress={() => startEditing('default')}
            variant="outline"
          />
          {hasMonthOverride ? (
            <ActionButton
              label="Reset to Default for This Month"
              onPress={() => { onClearMonthly(selectedMonth); }}
              variant="danger"
            />
          ) : null}
        </GlassCard>
      ) : (
        <GlassCard>
          <Text style={s.heading}>
            {editMode === 'default' ? 'Edit Default Budget' : `Edit ${mkLabel(selectedMonth)}`}
          </Text>
          <Text style={s.subtle}>
            {editMode === 'default'
              ? 'This applies to any month without a custom budget.'
              : 'This overrides the default for this month only.'}
          </Text>
          {categories.map((cat) => (
            <View key={cat.id} style={s.editRow}>
              <Text style={s.editLabel}>{cat.name}</Text>
              <TextInput
                style={s.editInput}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={C.textMuted}
                value={draft[cat.id] ?? ''}
                onChangeText={(v) => setDraft((p) => ({ ...p, [cat.id]: v }))}
                accessibilityLabel={`Budget for ${cat.name}`}
              />
            </View>
          ))}
          <View style={s.editActions}>
            <ActionButton label="Cancel" onPress={() => setEditing(false)} variant="outline" style={{ flex: 1 }} />
            <ActionButton label="Save" onPress={saveBudget} style={{ flex: 1 }} />
          </View>
        </GlassCard>
      )}
    </>
  );
}

const s = StyleSheet.create({
  heading: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  subtle: { color: C.textSubtle, fontSize: 12, marginBottom: 10 },
  metricsRow: { flexDirection: 'row', gap: 8 },

  utilCard: {
    borderRadius: 20, borderWidth: 1,
    padding: 16, marginBottom: 14,
    overflow: 'hidden',
  },

  fillTrack: {
    position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
    borderRadius: 20, overflow: 'hidden',
  },
  fillBar: { position: 'absolute', top: 0, left: 0, bottom: 0 },

  overviewHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  utilBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  utilBadgeText: { color: C.text, fontSize: 11, fontWeight: '700' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  navArrow: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  navDisabled: { backgroundColor: C.surface, opacity: 0.4 },
  navArrowText: { color: C.accent, fontSize: 18, fontWeight: '800' },
  navArrowDisabled: { color: C.textMuted },
  monthCenter: { alignItems: 'center' },
  monthTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  monthTag: { color: C.textMuted, fontSize: 11, marginTop: 3 },

  barTrack: {
    height: 10, borderRadius: 99, backgroundColor: C.borderLight,
    overflow: 'hidden', marginTop: 12,
  },
  barFill: { height: '100%', borderRadius: 99 },
  overBudget: { color: C.red, fontWeight: '700', fontSize: 12, marginTop: 6 },

  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  catBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { color: C.text, fontWeight: '700', fontSize: 14 },
  catPct: { color: C.green, fontWeight: '800', fontSize: 14 },
  catPctOver: { color: C.red },
  noBudget: { color: C.textMuted, fontSize: 12 },
  tagPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { color: C.text, fontSize: 10, fontWeight: '700' },

  catMetrics: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  catMetricItem: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.3)', borderRadius: 10,
    padding: 8, borderWidth: 1, borderColor: C.borderLight,
  },
  catMetricLabel: { color: C.textMuted, fontSize: 10 },
  catMetricVal: { color: C.text, fontWeight: '700', fontSize: 12, marginTop: 3 },
  overText: { color: C.red },

  catBar: {
    height: 6, borderRadius: 99, backgroundColor: C.borderLight, overflow: 'hidden',
  },
  catBarFill: { height: '100%', borderRadius: 99 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  editLabel: { color: C.text, fontWeight: '600', fontSize: 13, flex: 1 },
  editInput: {
    width: 120, borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: C.inputBg, color: C.text, fontSize: 14,
    textAlign: 'right',
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
