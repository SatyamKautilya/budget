import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Transaction, TransactionCategory, TransactionType } from './types';
import { formatCurrency, uid } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import MetricBox from '../../components/MetricBox';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';
import FormInput from '../../components/FormInput';
import ActionButton from '../../components/ActionButton';

type AddInput = { title: string; amount: number; type: TransactionType; categoryId: string | null };

type Props = {
  transactions: Transaction[];
  categories: TransactionCategory[];
  onAddTransaction: (input: AddInput) => void;
  onAssignCategory: (id: string, catId: string) => void;
  onDenyTransaction: (id: string) => void;
  onAddCategory: (cat: TransactionCategory) => void;
  onDeleteCategory: (catId: string) => void;
  onReadMessages: () => Promise<void>;
  onReadAllMessages: () => Promise<void>;
  isAutoSmsSyncEnabled: boolean;
  onToggleAutoSmsSync: () => void;
  isReadingMessages: boolean;
  readStatus: string;
};

type ViewMode = 'all' | 'monthly';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function TransactionsSection(props: Props) {
  const {
    transactions,
    categories,
    onAddTransaction,
    onAssignCategory,
    onDenyTransaction,
    onAddCategory,
    onDeleteCategory,
    onReadMessages,
    onReadAllMessages,
    isAutoSmsSyncEnabled,
    onToggleAutoSmsSync,
    isReadingMessages,
    readStatus,
  } = props;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('debit');
  const [catId, setCatId] = useState<string | null>(categories[0]?.id ?? null);
  const [error, setError] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newCatIdent, setNewCatIdent] = useState('');
  const [catErr, setCatErr] = useState('');
  const [showCatForm, setShowCatForm] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(monthKey(new Date()));
    transactions.forEach((t) => {
      if (t.createdAt) set.add(monthKey(new Date(t.createdAt)));
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (viewMode === 'all') return transactions;
    return transactions.filter((t) => t.createdAt && monthKey(new Date(t.createdAt)) === selectedMonth);
  }, [transactions, viewMode, selectedMonth]);

  const totals = useMemo(() => {
    const credit = filteredTransactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debit = filteredTransactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    return { credit, debit, net: credit - debit };
  }, [filteredTransactions]);

  const unassigned = filteredTransactions.filter((t) => !t.categoryId);
  const categorized = filteredTransactions.filter((t) => Boolean(t.categoryId));

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; credit: number; debit: number }> = {};
    categorized.forEach((t) => {
      const cat = categories.find((c) => c.id === t.categoryId);
      const name = cat?.name ?? 'Unknown';
      const key = t.categoryId ?? '_unknown';
      if (!map[key]) map[key] = { name, credit: 0, debit: 0 };
      if (t.type === 'credit') map[key].credit += t.amount;
      else map[key].debit += t.amount;
    });
    return Object.values(map).sort((a, b) => (b.debit + b.credit) - (a.debit + a.credit));
  }, [categorized, categories]);

  const navigateMonth = (dir: -1 | 1) => {
    const idx = availableMonths.indexOf(selectedMonth);
    const next = idx - dir;
    if (next >= 0 && next < availableMonths.length) setSelectedMonth(availableMonths[next]);
  };

  const handleAdd = () => {
    const parsed = Number(amount);
    if (!title.trim()) { setError('Add a title.'); return; }
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('Add a valid amount.'); return; }
    onAddTransaction({ title: title.trim(), amount: parsed, type, categoryId: catId });
    setTitle(''); setAmount(''); setType('debit');
    setCatId(categories[0]?.id ?? null); setError('');
  };

  const handleAddCategory = () => {
    const name = newCatName.trim();
    const identifier = newCatIdent.trim().toUpperCase();
    if (!name) { setCatErr('Enter category name.'); return; }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCatErr('Category already exists.'); return;
    }
    onAddCategory({ id: uid(), name, identifier });
    setNewCatName(''); setNewCatIdent(''); setCatErr(''); setShowCatForm(false);
  };

  const canGoBack = availableMonths.indexOf(selectedMonth) < availableMonths.length - 1;
  const canGoForward = availableMonths.indexOf(selectedMonth) > 0;

  return (
    <>
      {/* View Mode Toggle */}
      <GlassCard>
        <View style={s.modeRow}>
          <Pressable
            style={[s.modeBtn, viewMode === 'all' && s.modeBtnActive]}
            onPress={() => setViewMode('all')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'all' }}
          >
            <Text style={[s.modeText, viewMode === 'all' && s.modeTextActive]}>All Time</Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, viewMode === 'monthly' && s.modeBtnActive]}
            onPress={() => setViewMode('monthly')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'monthly' }}
          >
            <Text style={[s.modeText, viewMode === 'monthly' && s.modeTextActive]}>Monthly</Text>
          </Pressable>
        </View>

        {viewMode === 'monthly' ? (
          <View style={s.monthNav}>
            <Pressable
              style={[s.navArrow, !canGoBack && s.navDisabled]}
              onPress={() => navigateMonth(-1)}
              disabled={!canGoBack}
              accessibilityLabel="Previous month"
            >
              <Text style={[s.navArrowText, !canGoBack && s.navArrowDisabled]}>{'<'}</Text>
            </Pressable>
            <Text style={s.monthTitle}>{monthLabel(selectedMonth)}</Text>
            <Pressable
              style={[s.navArrow, !canGoForward && s.navDisabled]}
              onPress={() => navigateMonth(1)}
              disabled={!canGoForward}
              accessibilityLabel="Next month"
            >
              <Text style={[s.navArrowText, !canGoForward && s.navArrowDisabled]}>{'>'}</Text>
            </Pressable>
          </View>
        ) : null}
      </GlassCard>

      {/* Dashboard */}
      <GlassCard>
        <Text style={s.heading}>
          {viewMode === 'monthly' ? `${monthLabel(selectedMonth)} Summary` : 'Dashboard'}
        </Text>
        <View style={s.metricsRow}>
          <MetricBox label="Credit" value={formatCurrency(totals.credit)} />
          <MetricBox label="Debit" value={formatCurrency(totals.debit)} />
          <MetricBox label="Net" value={formatCurrency(totals.net)} />
        </View>
        <View style={[s.metricsRow, { marginTop: 8 }]}>
          <MetricBox label="Transactions" value={String(filteredTransactions.length)} />
          <MetricBox label="Unassigned" value={String(unassigned.length)} />
        </View>
      </GlassCard>

      {/* Category Breakdown (in monthly mode or if there are entries) */}
      {categoryBreakdown.length > 0 ? (
        <GlassCard>
          <Text style={s.heading}>Category Breakdown</Text>
          {categoryBreakdown.map((cb) => (
            <View key={cb.name} style={s.breakdownRow}>
              <Text style={s.breakdownName}>{cb.name}</Text>
              <View style={s.breakdownVals}>
                {cb.credit > 0 ? <Text style={s.breakdownCredit}>+{formatCurrency(cb.credit)}</Text> : null}
                {cb.debit > 0 ? <Text style={s.breakdownDebit}>-{formatCurrency(cb.debit)}</Text> : null}
              </View>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {/* Categories Management */}
      <GlassCard>
        <View style={s.catHeader}>
          <Text style={s.heading}>Categories</Text>
          <Pressable
            style={s.addCatToggle}
            onPress={() => setShowCatForm((p) => !p)}
            accessibilityRole="button"
            accessibilityLabel={showCatForm ? 'Close add category form' : 'Open add category form'}
          >
            <Text style={s.addCatToggleText}>{showCatForm ? 'Close' : '+ Add'}</Text>
          </Pressable>
        </View>
        <View style={s.chipWrap}>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              style={s.catChip}
              onLongPress={() => onDeleteCategory(c.id)}
              accessibilityRole="button"
              accessibilityHint="Long press to delete"
            >
              <Text style={s.catChipName}>{c.name}</Text>
              {c.identifier ? <Text style={s.catChipIdent}>{c.identifier}</Text> : null}
            </Pressable>
          ))}
        </View>
        <Text style={s.hint}>Long press a category to remove it.</Text>

        {showCatForm ? (
          <View style={s.catForm}>
            <FormInput label="Name" placeholder="e.g. Transport" value={newCatName} onChangeText={setNewCatName} />
            <FormInput label="SMS Identifier (optional)" placeholder="e.g. UBER" value={newCatIdent} onChangeText={setNewCatIdent} />
            {catErr ? <Text style={s.error}>{catErr}</Text> : null}
            <ActionButton label="Save Category" onPress={handleAddCategory} />
          </View>
        ) : null}
      </GlassCard>

      {/* SMS Integration */}
      <GlassCard>
        <Text style={s.heading}>SMS Integration</Text>
        <Text style={s.subtle}>
          Identifiers auto-assign category from SMS content. Unmatched go to pool.
        </Text>
        <ActionButton
          label={isReadingMessages ? 'Reading...' : 'Read Recent SMS'}
          onPress={onReadMessages}
          disabled={isReadingMessages}
        />
        <ActionButton label="Read All Past SMS" onPress={onReadAllMessages} variant="outline" disabled={isReadingMessages} />
        <ActionButton
          label={isAutoSmsSyncEnabled ? 'Auto Sync: ON' : 'Auto Sync: OFF'}
          onPress={onToggleAutoSmsSync}
          variant="outline"
        />
        {readStatus ? <Text style={[s.subtle, { marginTop: 8 }]}>{readStatus}</Text> : null}
      </GlassCard>

      {/* Add Transaction */}
      <GlassCard>
        <Text style={s.heading}>Add Transaction</Text>
        <FormInput label="Title" placeholder="e.g. Grocery" value={title} onChangeText={setTitle} />
        <FormInput label="Amount" placeholder="e.g. 1200" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Text style={s.subtle}>Type</Text>
        <View style={s.toggleRow}>
          {(['debit', 'credit'] as TransactionType[]).map((o) => (
            <Pressable key={o} style={[s.toggle, type === o && s.toggleActive]} onPress={() => setType(o)} accessibilityRole="button">
              <Text style={s.toggleText}>{o.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.subtle}>Category</Text>
        <View style={s.chipWrap}>
          {categories.map((c) => (
            <Pressable key={c.id} style={[s.chip, catId === c.id && s.chipActive]} onPress={() => setCatId(c.id)} accessibilityRole="button">
              <Text style={s.chipText}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <ActionButton label="Add Transaction" onPress={handleAdd} />
      </GlassCard>

      {/* Unassigned Pool */}
      {unassigned.length > 0 ? (
        <>
          <SectionHeading title="Unassigned Pool" subtitle={`${unassigned.length} entries need a category`} />
          {unassigned.map((item) => (
            <GlassCard key={item.id}>
              <View style={s.txHeader}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.txDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </Text>
              </View>
              {item.rawMessage ? <Text style={s.rawMsg} numberOfLines={2}>{item.rawMessage}</Text> : null}
              <Text style={s.rowAmount}>{formatCurrency(item.amount)}</Text>
              <View style={s.chipWrap}>
                {categories.map((c) => (
                  <Pressable key={`${item.id}-${c.id}`} style={s.chip} onPress={() => onAssignCategory(item.id, c.id)} accessibilityRole="button">
                    <Text style={s.chipText}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
              <ActionButton label="Deny Entry" onPress={() => onDenyTransaction(item.id)} variant="danger" />
            </GlassCard>
          ))}
        </>
      ) : null}

      {/* Categorized Transactions */}
      <SectionHeading title="Categorized" />
      {categorized.length === 0 ? (
        <EmptyState title="No entries" message="Categorized transactions appear here." />
      ) : (
        categorized.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          return (
            <GlassCard key={item.id}>
              <View style={s.catRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  <Text style={s.subtle}>
                    {item.type.toUpperCase()} · {cat?.name ?? 'Unknown'}
                    {item.createdAt ? `  ·  ${new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                  </Text>
                </View>
                <Text style={[s.rowAmount, item.type === 'credit' ? s.creditColor : s.debitColor]}>
                  {item.type === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
                </Text>
              </View>
            </GlassCard>
          );
        })
      )}
    </>
  );
}

const s = StyleSheet.create({
  heading: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  subtle: { color: C.textSubtle, fontSize: 12, marginBottom: 6 },
  hint: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  metricsRow: { flexDirection: 'row', gap: 8 },

  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface,
  },
  modeBtnActive: { backgroundColor: C.accentSoft, borderColor: C.accent },
  modeText: { color: C.textSubtle, fontWeight: '700', fontSize: 13 },
  modeTextActive: { color: C.accent },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 4,
  },
  navArrow: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center',
  },
  navDisabled: { backgroundColor: C.surface, opacity: 0.4 },
  navArrowText: { color: C.accent, fontSize: 18, fontWeight: '800' },
  navArrowDisabled: { color: C.textMuted },
  monthTitle: { color: C.text, fontSize: 16, fontWeight: '700' },

  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.borderLight,
    padding: 10, marginBottom: 6,
  },
  breakdownName: { color: C.text, fontWeight: '600', fontSize: 13, flex: 1 },
  breakdownVals: { flexDirection: 'row', gap: 10 },
  breakdownCredit: { color: C.green, fontWeight: '700', fontSize: 12 },
  breakdownDebit: { color: C.red, fontWeight: '700', fontSize: 12 },

  catHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addCatToggle: {
    backgroundColor: C.accentSoft, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  addCatToggleText: { color: C.accent, fontWeight: '700', fontSize: 13 },
  catChip: {
    borderRadius: 12, borderWidth: 1, borderColor: C.borderLight,
    backgroundColor: C.inputBg, paddingHorizontal: 12, paddingVertical: 8,
  },
  catChipName: { color: C.text, fontWeight: '600', fontSize: 13 },
  catChipIdent: { color: C.textMuted, fontSize: 10, marginTop: 2 },
  catForm: {
    marginTop: 10, backgroundColor: C.inputBg, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderLight, padding: 12,
  },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  toggle: {
    flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1,
    borderColor: C.inputBorder, paddingVertical: 11,
  },
  toggleActive: { backgroundColor: C.cyanSoft, borderColor: C.cyan },
  toggleText: { color: C.text, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1, borderColor: C.inputBorder,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipActive: { backgroundColor: C.cyanSoft, borderColor: C.cyan },
  chipText: { color: C.textSubtle, fontSize: 12, fontWeight: '600' },
  error: { color: C.red, marginBottom: 6, fontWeight: '600' },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txDate: { color: C.textMuted, fontSize: 11 },
  rowTitle: { color: C.text, fontWeight: '700', fontSize: 14 },
  rawMsg: { color: C.textMuted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  rowAmount: { color: C.cyan, marginTop: 6, fontWeight: '700' },
  creditColor: { color: C.green },
  debitColor: { color: C.red },
  catRow: { flexDirection: 'row', alignItems: 'center' },
});
