import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from './src/theme/colors';
import { formatCurrency, uid } from './src/theme';
import {
  SectionName,
  Loan,
  Asset,
  Income,
  BudgetData,
  BudgetAllocation,
  LentLoan,
} from './src/types';
import { Transaction, TransactionCategory } from './src/features/transactions/types';
import { DEFAULT_CATEGORIES } from './src/features/transactions/constants';
import { calculateEmi } from './src/features/loans/loanMath';
import { messageToTransaction } from './src/features/transactions/utils';
import { readInboxMessages } from './src/features/transactions/deviceMessages';

import LoansSection from './src/features/loans/LoansSection';
import AssetsSection from './src/features/assets/AssetsSection';
import IncomeSection from './src/features/income/IncomeSection';
import TransactionsSection from './src/features/transactions/TransactionsSection';
import BudgetSection from './src/features/budget/BudgetSection';
import ProfileSection from './src/features/profile/ProfileSection';
import LentSection from './src/features/lent/LentSection';

import BottomSheet from './src/components/BottomSheet';
import FormInput from './src/components/FormInput';
import ActionButton from './src/components/ActionButton';
import SectionHeading from './src/components/SectionHeading';

const TAB_CONFIG: { key: SectionName; label: string; icon: string }[] = [
  { key: 'Loans', label: 'Loans', icon: '🏦' },
  { key: 'Assets', label: 'Assets', icon: '💎' },
  { key: 'Income', label: 'Income', icon: '💰' },
  { key: 'Txns', label: 'Txns', icon: '📊' },
  { key: 'Budget', label: 'Budget', icon: '🎯' },
  { key: 'Lent', label: 'Lent', icon: '🤝' },
  { key: 'Profile', label: 'Profile', icon: '👤' },
];
const EMPTY_BUDGET: BudgetData = { defaultBudget: {}, monthlyBudgets: {} };
const STORAGE_KEY = 'finance_hub_data_v2';

export default function App() {
  const insets = useSafeAreaInsets();
  /** Safe area + extra gap below status bar / notch; floor for Android when insets are 0 */
  const topPad = Math.max(insets.top + 28, Platform.OS === 'android' ? 52 : 44);

  const [tab, setTab] = useState<SectionName>('Loans');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>(DEFAULT_CATEGORIES);
  const [budgetData, setBudgetData] = useState<BudgetData>(EMPTY_BUDGET);
  const [lentLoans, setLentLoans] = useState<LentLoan[]>([]);
  const [lentFabKey, setLentFabKey] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [isReadingSms, setIsReadingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState('');
  const [autoSmsSync, setAutoSmsSync] = useState(false);

  const [showLoan, setShowLoan] = useState(false);
  const [showAsset, setShowAsset] = useState(false);
  const [showIncome, setShowIncome] = useState(false);

  const [lTitle, setLTitle] = useState('');
  const [lAmount, setLAmount] = useState('');
  const [lDate, setLDate] = useState('');
  const [lTenure, setLTenure] = useState('');
  const [lRate, setLRate] = useState('');
  const [showDP, setShowDP] = useState(false);
  const [lErr, setLErr] = useState('');

  const [aTitle, setATitle] = useState('');
  const [aPrice, setAPrice] = useState('');
  const [aErr, setAErr] = useState('');

  const [iTitle, setITitle] = useState('');
  const [iAmount, setIAmount] = useState('');
  const [iErr, setIErr] = useState('');

  const smsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          setLoans(Array.isArray(d.loans) ? d.loans : []);
          setAssets(Array.isArray(d.assets) ? d.assets : []);
          setIncomes(Array.isArray(d.incomes) ? d.incomes : []);
          setTransactions(Array.isArray(d.transactions) ? d.transactions : []);
          setCategories(Array.isArray(d.categories) ? d.categories : DEFAULT_CATEGORIES);
          setBudgetData(d.budgetData && typeof d.budgetData === 'object' ? d.budgetData : EMPTY_BUDGET);
          setLentLoans(Array.isArray(d.lentLoans) ? d.lentLoans : []);
          setAutoSmsSync(Boolean(d.autoSmsSync));
        }
      } catch { /* ignore */ } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        loans,
        assets,
        incomes,
        transactions,
        categories,
        budgetData,
        lentLoans,
        autoSmsSync,
      })
    ).catch(() => {});
  }, [loans, assets, incomes, transactions, categories, budgetData, lentLoans, autoSmsSync, hydrated]);

  useEffect(() => {
    if (smsIntervalRef.current) clearInterval(smsIntervalRef.current);
    if (!autoSmsSync) return;
    smsIntervalRef.current = setInterval(() => ingestSms(50, true), 30000);
    return () => { if (smsIntervalRef.current) clearInterval(smsIntervalRef.current); };
  }, [autoSmsSync]);

  const ingestSms = async (max: number, silent = false) => {
    try {
      setIsReadingSms(true);
      if (!silent) setSmsStatus('');
      const msgs = await readInboxMessages(max);
      const mapped = msgs.map((m) => messageToTransaction(m, categories)).filter(Boolean) as Transaction[];
      setTransactions((prev) => {
        const known = new Set(prev.filter((t) => t.smsMessageId).map((t) => t.smsMessageId));
        const fresh = mapped.filter((t) => t.smsMessageId && !known.has(t.smsMessageId));
        if (!silent) {
          if (mapped.length === 0) setSmsStatus('No transaction SMS found.');
          else if (fresh.length === 0) setSmsStatus('No new entries.');
          else {
            const pool = fresh.filter((t) => !t.categoryId).length;
            setSmsStatus(`Created ${fresh.length} entries. ${pool} in pool.`);
          }
        }
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
    } catch (e) {
      if (!silent) setSmsStatus(e instanceof Error ? e.message : 'SMS read failed.');
    } finally {
      setIsReadingSms(false);
    }
  };

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const onDateChange = (ev: DateTimePickerEvent, d?: Date) => {
    if (Platform.OS === 'android') setShowDP(false);
    if (ev.type !== 'dismissed' && d) { setLDate(fmtDate(d)); setLErr(''); }
  };

  const addLoan = () => {
    const amt = Number(lAmount), ten = Number(lTenure), rate = Number(lRate);
    if (!lTitle.trim()) { setLErr('Enter title.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setLErr('Enter valid amount.'); return; }
    if (!lDate) { setLErr('Pick EMI date.'); return; }
    if (!Number.isFinite(ten) || ten <= 0) { setLErr('Enter tenure.'); return; }
    if (!Number.isFinite(rate) || rate < 0) { setLErr('Enter valid rate.'); return; }
    const emi = calculateEmi(amt, rate, ten);
    setLoans((p) => [{ id: uid(), title: lTitle.trim(), amount: amt, firstEmiDate: lDate, tenureMonths: ten, interestRate: rate, emi, totalPayable: emi * ten }, ...p]);
    setLTitle(''); setLAmount(''); setLDate(''); setLTenure(''); setLRate(''); setLErr(''); setShowDP(false); setShowLoan(false);
  };

  const addAsset = () => {
    const p = Number(aPrice);
    if (!aTitle.trim()) { setAErr('Enter title.'); return; }
    if (!Number.isFinite(p) || p <= 0) { setAErr('Enter valid price.'); return; }
    setAssets((prev) => [{ id: uid(), title: aTitle.trim(), price: p }, ...prev]);
    setATitle(''); setAPrice(''); setAErr(''); setShowAsset(false);
  };

  const addIncome = () => {
    const a = Number(iAmount);
    if (!iTitle.trim()) { setIErr('Enter title.'); return; }
    if (!Number.isFinite(a) || a <= 0) { setIErr('Enter valid amount.'); return; }
    setIncomes((prev) => [{ id: uid(), title: iTitle.trim(), amount: a }, ...prev]);
    setITitle(''); setIAmount(''); setIErr(''); setShowIncome(false);
  };

  const addTransaction = (input: { title: string; amount: number; type: 'debit' | 'credit'; categoryId: string | null }) => {
    setTransactions((p) => [{ id: uid(), ...input, source: 'manual' as const, createdAt: new Date().toISOString() }, ...p]);
  };

  const assignCat = (txId: string, catId: string) =>
    setTransactions((p) => p.map((t) => (t.id === txId ? { ...t, categoryId: catId } : t)));

  const denyTx = (txId: string) => setTransactions((p) => p.filter((t) => t.id !== txId));

  const addCategory = (cat: TransactionCategory) => setCategories((p) => [...p, cat]);
  const deleteCategory = (catId: string) => setCategories((p) => p.filter((c) => c.id !== catId));

  const updateDefaultBudget = (budget: BudgetAllocation) =>
    setBudgetData((p) => ({ ...p, defaultBudget: budget }));

  const updateMonthlyBudget = (monthKey: string, budget: BudgetAllocation) =>
    setBudgetData((p) => ({ ...p, monthlyBudgets: { ...p.monthlyBudgets, [monthKey]: budget } }));

  const clearMonthlyBudget = (monthKey: string) =>
    setBudgetData((p) => {
      const { [monthKey]: _, ...rest } = p.monthlyBudgets;
      return { ...p, monthlyBudgets: rest };
    });

  const addLentLoan = (input: { borrowerName: string; principal: number; notes?: string }) => {
    const row: LentLoan = {
      id: uid(),
      borrowerName: input.borrowerName,
      principal: input.principal,
      payments: [],
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    setLentLoans((p) => [row, ...p]);
  };

  const updateLentLoan = (loanId: string, input: { borrowerName: string; principal: number; notes?: string }) => {
    setLentLoans((p) =>
      p.map((l) =>
        l.id === loanId
          ? { ...l, borrowerName: input.borrowerName, principal: input.principal, notes: input.notes }
          : l
      )
    );
  };

  const deleteLentLoan = (loanId: string) => setLentLoans((p) => p.filter((l) => l.id !== loanId));

  const addLentPayment = (loanId: string, input: { amount: number; note?: string }) => {
    setLentLoans((p) =>
      p.map((l) =>
        l.id === loanId
          ? {
              ...l,
              payments: [
                {
                  id: uid(),
                  amount: input.amount,
                  note: input.note,
                  recordedAt: new Date().toISOString(),
                },
                ...l.payments,
              ],
            }
          : l
      )
    );
  };

  const updateLentPayment = (
    loanId: string,
    paymentId: string,
    input: { amount: number; note?: string }
  ) => {
    setLentLoans((p) =>
      p.map((l) =>
        l.id !== loanId
          ? l
          : {
              ...l,
              payments: l.payments.map((x) =>
                x.id === paymentId ? { ...x, amount: input.amount, note: input.note } : x
              ),
            }
      )
    );
  };

  const deleteLentPayment = (loanId: string, paymentId: string) => {
    setLentLoans((p) =>
      p.map((l) =>
        l.id !== loanId ? l : { ...l, payments: l.payments.filter((x) => x.id !== paymentId) }
      )
    );
  };

  const fabLabel =
    tab === 'Loans'
      ? '+ Add Loan'
      : tab === 'Assets'
        ? '+ Add Asset'
        : tab === 'Income'
          ? '+ Add Income'
          : tab === 'Lent'
            ? '+ Add Lent'
            : null;

  const fabAction = () => {
    if (tab === 'Loans') setShowLoan(true);
    else if (tab === 'Assets') setShowAsset(true);
    else if (tab === 'Income') setShowIncome(true);
    else if (tab === 'Lent') setLentFabKey((k) => k + 1);
  };

  return (
    <View style={s.safe}>
      <View style={[s.container, { paddingTop: topPad }]}>
        <View style={s.bubbleA} />
        <View style={s.bubbleB} />

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {tab === 'Loans' && <LoansSection loans={loans} />}
          {tab === 'Assets' && <AssetsSection assets={assets} />}
          {tab === 'Income' && <IncomeSection incomes={incomes} />}
          {tab === 'Txns' && (
            <TransactionsSection
              transactions={transactions}
              categories={categories}
              onAddTransaction={addTransaction}
              onAssignCategory={assignCat}
              onDenyTransaction={denyTx}
              onAddCategory={addCategory}
              onDeleteCategory={deleteCategory}
              onReadMessages={() => ingestSms(50)}
              onReadAllMessages={() => ingestSms(5000)}
              isAutoSmsSyncEnabled={autoSmsSync}
              onToggleAutoSmsSync={() => setAutoSmsSync((p) => !p)}
              isReadingMessages={isReadingSms}
              readStatus={smsStatus}
            />
          )}
          {tab === 'Budget' && (
            <BudgetSection
              budgetData={budgetData}
              categories={categories}
              transactions={transactions}
              onUpdateDefault={updateDefaultBudget}
              onUpdateMonthly={updateMonthlyBudget}
              onClearMonthly={clearMonthlyBudget}
            />
          )}
          {tab === 'Lent' && (
            <LentSection
              openAddSignal={lentFabKey}
              lentLoans={lentLoans}
              onAddLoan={addLentLoan}
              onUpdateLoan={updateLentLoan}
              onDeleteLoan={deleteLentLoan}
              onAddPayment={addLentPayment}
              onUpdatePayment={updateLentPayment}
              onDeletePayment={deleteLentPayment}
            />
          )}
          {tab === 'Profile' && (
            <ProfileSection
              loans={loans}
              assets={assets}
              incomes={incomes}
              transactions={transactions}
              categories={categories}
            />
          )}
        </ScrollView>

        {fabLabel ? (
          <Pressable
            style={s.fab}
            onPress={fabAction}
            accessibilityRole="button"
            accessibilityLabel={fabLabel}
          >
            <Text style={s.fabText}>{fabLabel}</Text>
          </Pressable>
        ) : null}

        <View style={s.bottomNav}>
          {TAB_CONFIG.map((t) => (
            <Pressable
              key={t.key}
              style={s.navItem}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              accessibilityLabel={t.label}
            >
              <Text style={s.navIcon}>{t.icon}</Text>
              <Text style={[s.navLabel, tab === t.key && s.navLabelActive]}>
                {t.label}
              </Text>
              {tab === t.key ? <View style={s.navDot} /> : null}
            </Pressable>
          ))}
        </View>

        <BottomSheet visible={showLoan} onClose={() => setShowLoan(false)}>
          <SectionHeading title="Add Loan" subtitle="Enter EMI details" />
          <FormInput label="Title" placeholder="e.g. Home Loan HDFC" value={lTitle} onChangeText={setLTitle} />
          <FormInput label="Amount" placeholder="e.g. 500000" value={lAmount} onChangeText={setLAmount} keyboardType="decimal-pad" />
          <Text style={s.fieldLabel}>First EMI Date</Text>
          <Pressable style={s.dateBtn} onPress={() => setShowDP(true)} accessibilityLabel="Pick EMI date">
            <Text style={lDate ? s.dateVal : s.datePlaceholder}>{lDate || 'Select from calendar'}</Text>
          </Pressable>
          {showDP && (
            <DateTimePicker
              value={lDate ? new Date(lDate) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}
          <FormInput label="Tenure (months)" placeholder="e.g. 60" value={lTenure} onChangeText={setLTenure} keyboardType="number-pad" />
          <FormInput label="Interest Rate (%)" placeholder="e.g. 9.5" value={lRate} onChangeText={setLRate} keyboardType="decimal-pad" />
          {lErr ? <Text style={s.err}>{lErr}</Text> : null}
          <ActionButton label="Save Loan" onPress={addLoan} />
        </BottomSheet>

        <BottomSheet visible={showAsset} onClose={() => setShowAsset(false)}>
          <SectionHeading title="Add Asset" subtitle="What do you own?" />
          <FormInput label="Title" placeholder="e.g. Gold, Car" value={aTitle} onChangeText={setATitle} />
          <FormInput label="Price" placeholder="e.g. 250000" value={aPrice} onChangeText={setAPrice} keyboardType="decimal-pad" />
          {aErr ? <Text style={s.err}>{aErr}</Text> : null}
          <ActionButton label="Save Asset" onPress={addAsset} />
        </BottomSheet>

        <BottomSheet visible={showIncome} onClose={() => setShowIncome(false)}>
          <SectionHeading title="Add Income" subtitle="Track your earnings" />
          <FormInput label="Title" placeholder="e.g. Salary" value={iTitle} onChangeText={setITitle} />
          <FormInput label="Amount" placeholder="e.g. 85000" value={iAmount} onChangeText={setIAmount} keyboardType="decimal-pad" />
          {iErr ? <Text style={s.err}>{iErr}</Text> : null}
          <ActionButton label="Save Income" onPress={addIncome} />
        </BottomSheet>

        <StatusBar style="light" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 16 },
  bubbleA: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.accentSoft,
  },
  bubbleB: {
    position: 'absolute', top: 260, left: -70,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: C.purpleSoft,
  },
  scroll: { paddingBottom: Platform.OS === 'android' ? 200 : 170 },
  fab: {
    position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'android' ? 104 : 86,
    backgroundColor: C.accent, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: C.accent, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#0c1222', fontWeight: '800', fontSize: 15 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(8,15,30,0.97)',
    borderTopWidth: 1, borderTopColor: C.border,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 38 : 24,
    paddingHorizontal: 4,
  },
  navItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2,
  },
  navIcon: { fontSize: 18, marginBottom: 3 },
  navLabel: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  navLabelActive: { color: C.accent },
  navDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: C.accent, marginTop: 3,
  },
  fieldLabel: { color: C.textSubtle, fontWeight: '600', marginBottom: 5, fontSize: 13 },
  dateBtn: {
    borderWidth: 1, borderColor: C.inputBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: C.inputBg, marginBottom: 6,
  },
  dateVal: { color: C.text },
  datePlaceholder: { color: C.textMuted },
  err: { color: C.red, fontWeight: '600', marginBottom: 6 },
});
