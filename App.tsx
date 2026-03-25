import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import TransactionsSection from './src/features/transactions/TransactionsSection';
import { messageToTransaction } from './src/features/transactions/utils';
import { readInboxMessages } from './src/features/transactions/deviceMessages';
import { Transaction } from './src/features/transactions/types';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type SectionName = 'Loans' | 'Assests' | 'Income' | 'Transactions' | 'Profile';

type Loan = {
  id: string;
  title: string;
  amount: number;
  firstEmiDate: string;
  tenureMonths: number;
  interestRate: number;
  emi: number;
  totalPayable: number;
};

type LoanStats = Loan & {
  paidMonths: number;
  paidAmount: number;
  paidInterest: number;
  paidPrincipal: number;
  outstanding: number;
  progressPercent: number;
};

type AmortizationRow = {
  dueDate: Date;
  emi: number;
  principal: number;
  interest: number;
};

type Asset = {
  id: string;
  title: string;
  price: number;
};

type Income = {
  id: string;
  title: string;
  amount: number;
};

const STORAGE_KEY = 'finance_hub_data_v1';

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionName>('Loans');
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [loanTitle, setLoanTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [firstEmiDate, setFirstEmiDate] = useState('');
  const [tenure, setTenure] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [assetTitle, setAssetTitle] = useState('');
  const [assetPrice, setAssetPrice] = useState('');
  const [incomeError, setIncomeError] = useState('');
  const [incomeTitle, setIncomeTitle] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isReadingMessages, setIsReadingMessages] = useState(false);
  const [readStatus, setReadStatus] = useState('');
  const [isAutoSmsSyncEnabled, setIsAutoSmsSyncEnabled] = useState(false);

  const formatCurrency = (value: number) => `Rs ${value.toFixed(2)}`;

  const calculateEmi = (principal: number, annualRate: number, months: number) => {
    if (annualRate === 0) {
      return principal / months;
    }
    const monthlyRate = annualRate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * factor) / (factor - 1);
  };

  const addMonths = (date: Date, count: number) => {
    return new Date(date.getFullYear(), date.getMonth() + count, date.getDate());
  };

  const monthKey = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;

  const monthLabel = (date: Date) =>
    date.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
    });

  const resetForm = () => {
    setLoanTitle('');
    setAmount('');
    setFirstEmiDate('');
    setTenure('');
    setInterestRate('');
    setShowDatePicker(false);
    setError('');
  };

  const resetAssetForm = () => {
    setAssetTitle('');
    setAssetPrice('');
    setAssetError('');
  };

  const resetIncomeForm = () => {
    setIncomeTitle('');
    setIncomeAmount('');
    setIncomeError('');
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setFirstEmiDate(formatDate(selectedDate));
    setError('');
  };

  const getPaidMonths = (firstDateText: string, tenureMonths: number) => {
    const firstDate = new Date(firstDateText);
    if (Number.isNaN(firstDate.getTime())) {
      return 0;
    }

    const now = new Date();
    if (now < firstDate) {
      return 0;
    }

    const monthDiff =
      (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth());
    const shouldCountCurrentMonth = now.getDate() >= firstDate.getDate() ? 1 : 0;
    return Math.max(0, Math.min(tenureMonths, monthDiff + shouldCountCurrentMonth));
  };

  const calculateLoanStats = (loan: Loan): LoanStats => {
    const monthlyRate = loan.interestRate / 12 / 100;
    const paidMonths = getPaidMonths(loan.firstEmiDate, loan.tenureMonths);
    let outstanding = loan.amount;
    let paidInterest = 0;
    let paidPrincipal = 0;

    for (let month = 0; month < paidMonths; month += 1) {
      const interestPart = monthlyRate === 0 ? 0 : outstanding * monthlyRate;
      let principalPart = loan.emi - interestPart;
      if (principalPart > outstanding || month === loan.tenureMonths - 1) {
        principalPart = outstanding;
      }
      if (principalPart < 0) {
        principalPart = 0;
      }

      outstanding -= principalPart;
      paidInterest += interestPart;
      paidPrincipal += principalPart;
    }

    outstanding = Math.max(0, outstanding);
    const paidAmount = paidPrincipal + paidInterest;
    const progressPercent = loan.amount === 0 ? 0 : Math.min(100, (paidPrincipal / loan.amount) * 100);

    return {
      ...loan,
      paidMonths,
      paidAmount,
      paidInterest,
      paidPrincipal,
      outstanding,
      progressPercent,
    };
  };

  const buildAmortizationSchedule = (loan: Loan): AmortizationRow[] => {
    const firstDate = new Date(loan.firstEmiDate);
    if (Number.isNaN(firstDate.getTime())) {
      return [];
    }

    const monthlyRate = loan.interestRate / 12 / 100;
    let outstanding = loan.amount;
    const schedule: AmortizationRow[] = [];

    for (let month = 0; month < loan.tenureMonths; month += 1) {
      const interestPart = monthlyRate === 0 ? 0 : outstanding * monthlyRate;
      let principalPart = loan.emi - interestPart;
      if (principalPart > outstanding || month === loan.tenureMonths - 1) {
        principalPart = outstanding;
      }
      if (principalPart < 0) {
        principalPart = 0;
      }

      const emiForMonth = principalPart + interestPart;
      schedule.push({
        dueDate: addMonths(firstDate, month),
        emi: emiForMonth,
        principal: principalPart,
        interest: interestPart,
      });
      outstanding = Math.max(0, outstanding - principalPart);
    }

    return schedule;
  };

  const loansWithStats = useMemo(() => loans.map(calculateLoanStats), [loans]);

  const totals = useMemo(
    () =>
      loansWithStats.reduce(
        (acc, loan) => ({
          principal: acc.principal + loan.amount,
          monthlyEmi: acc.monthlyEmi + loan.emi,
          totalPayable: acc.totalPayable + loan.totalPayable,
          outstanding: acc.outstanding + loan.outstanding,
          paidAmount: acc.paidAmount + loan.paidAmount,
          paidInterest: acc.paidInterest + loan.paidInterest,
          paidPrincipal: acc.paidPrincipal + loan.paidPrincipal,
        }),
        {
          principal: 0,
          monthlyEmi: 0,
          totalPayable: 0,
          outstanding: 0,
          paidAmount: 0,
          paidInterest: 0,
          paidPrincipal: 0,
        }
      ),
    [loansWithStats]
  );

  const monthlyProjection = useMemo(() => {
    const startOfCurrentMonth = new Date();
    startOfCurrentMonth.setDate(1);
    startOfCurrentMonth.setHours(0, 0, 0, 0);

    const byMonth: Record<string, { date: Date; emi: number; principal: number; interest: number }> = {};

    loans.forEach((loan) => {
      const schedule = buildAmortizationSchedule(loan);
      schedule.forEach((entry) => {
        if (entry.dueDate < startOfCurrentMonth) {
          return;
        }
        const key = monthKey(entry.dueDate);
        if (!byMonth[key]) {
          byMonth[key] = { date: entry.dueDate, emi: 0, principal: 0, interest: 0 };
        }
        byMonth[key].emi += entry.emi;
        byMonth[key].principal += entry.principal;
        byMonth[key].interest += entry.interest;
      });
    });

    return Object.values(byMonth)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6)
      .map((entry) => ({
        ...entry,
        label: monthLabel(entry.date),
      }));
  }, [loans]);

  const totalAssetValue = useMemo(
    () => assets.reduce((sum, asset) => sum + asset.price, 0),
    [assets]
  );
  const totalIncomeValue = useMemo(
    () => incomes.reduce((sum, income) => sum + income.amount, 0),
    [incomes]
  );

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setIsHydrated(true);
          return;
        }

        const parsed = JSON.parse(raw) as {
          loans?: Loan[];
          assets?: Asset[];
          incomes?: Income[];
          transactions?: Transaction[];
          isAutoSmsSyncEnabled?: boolean;
        };
        setLoans(Array.isArray(parsed.loans) ? parsed.loans : []);
        setAssets(Array.isArray(parsed.assets) ? parsed.assets : []);
        setIncomes(Array.isArray(parsed.incomes) ? parsed.incomes : []);
        setTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : []);
        setIsAutoSmsSyncEnabled(Boolean(parsed.isAutoSmsSyncEnabled));
      } catch (storageError) {
        console.warn('Failed to load app data', storageError);
      } finally {
        setIsHydrated(true);
      }
    };

    loadStoredData();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persistData = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            loans,
            assets,
            incomes,
            transactions,
            isAutoSmsSyncEnabled,
          })
        );
      } catch (storageError) {
        console.warn('Failed to save app data', storageError);
      }
    };

    persistData();
  }, [loans, assets, incomes, transactions, isAutoSmsSyncEnabled, isHydrated]);

  const handleAddLoan = () => {
    const parsedAmount = Number(amount);
    const parsedTenure = Number(tenure);
    const parsedRate = Number(interestRate);

    if (!loanTitle.trim()) {
      setError('Please enter a loan title.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (!firstEmiDate.trim()) {
      setError('Please enter first EMI date.');
      return;
    }

    if (!Number.isFinite(parsedTenure) || parsedTenure <= 0) {
      setError('Please enter a valid tenure in months.');
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setError('Please enter a valid interest rate.');
      return;
    }

    const emi = calculateEmi(parsedAmount, parsedRate, parsedTenure);

    const loan: Loan = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: loanTitle.trim(),
      amount: parsedAmount,
      firstEmiDate: firstEmiDate.trim(),
      tenureMonths: parsedTenure,
      interestRate: parsedRate,
      emi,
      totalPayable: emi * parsedTenure,
    };

    setLoans((prevLoans) => [loan, ...prevLoans]);
    resetForm();
    setShowAddLoanModal(false);
  };

  const handleAddAsset = () => {
    const parsedPrice = Number(assetPrice);

    if (!assetTitle.trim()) {
      setAssetError('Please enter asset title.');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setAssetError('Please enter a valid asset price.');
      return;
    }

    const asset: Asset = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: assetTitle.trim(),
      price: parsedPrice,
    };

    setAssets((prev) => [asset, ...prev]);
    resetAssetForm();
    setShowAddAssetModal(false);
  };

  const handleAddIncome = () => {
    const parsedAmount = Number(incomeAmount);

    if (!incomeTitle.trim()) {
      setIncomeError('Please enter income title.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setIncomeError('Please enter a valid income amount.');
      return;
    }

    const income: Income = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: incomeTitle.trim(),
      amount: parsedAmount,
    };

    setIncomes((prev) => [income, ...prev]);
    resetIncomeForm();
    setShowAddIncomeModal(false);
  };

  const handleAddTransaction = (input: {
    title: string;
    amount: number;
    type: 'debit' | 'credit';
    categoryId: string | null;
  }) => {
    const transaction: Transaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: input.title,
      amount: input.amount,
      type: input.type,
      categoryId: input.categoryId,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [transaction, ...prev]);
  };

  const handleAssignTransactionCategory = (transactionId: string, categoryId: string) => {
    setTransactions((prev) =>
      prev.map((item) => (item.id === transactionId ? { ...item, categoryId } : item))
    );
  };

  const handleDenyTransaction = (transactionId: string) => {
    setTransactions((prev) => prev.filter((item) => item.id !== transactionId));
  };

  const handleReadMessages = async () => {
    await readAndCreateFromMessages(50, 'recent');
  };

  const handleReadAllMessages = async () => {
    await readAndCreateFromMessages(5000, 'all');
  };

  const readAndCreateFromMessages = async (
    maxCount: number,
    scope: 'recent' | 'all',
    silent = false
  ) => {
    try {
      setIsReadingMessages(true);
      if (!silent) {
        setReadStatus('');
      }
      const messages = await readInboxMessages(maxCount);
      const mapped = messages.map(messageToTransaction).filter(Boolean) as Transaction[];
      setTransactions((prev) => {
        const knownSmsIds = new Set(
          prev.filter((item) => item.source === 'sms' && item.smsMessageId).map((item) => item.smsMessageId)
        );
        const newItems = mapped.filter((item) => item.smsMessageId && !knownSmsIds.has(item.smsMessageId));

        if (!silent) {
          if (mapped.length === 0) {
            setReadStatus(
              scope === 'all'
                ? 'No transaction-like SMS found in your past inbox messages.'
                : 'No transaction-like SMS found in recent inbox messages.'
            );
          } else if (newItems.length === 0) {
            setReadStatus('No new SMS transaction entries found.');
          } else {
            const unassignedCount = newItems.filter((item) => !item.categoryId).length;
            setReadStatus(
              `${scope === 'all' ? 'Read all past messages.' : 'Read recent messages.'} Created ${
                newItems.length
              } new entries. ${unassignedCount} moved to unassigned pool.`
            );
          }
        }

        if (newItems.length === 0) {
          return prev;
        }
        return [...newItems, ...prev];
      });
    } catch (readError) {
      if (!silent) {
        setReadStatus(readError instanceof Error ? readError.message : 'Failed to read messages.');
      }
    } finally {
      setIsReadingMessages(false);
    }
  };

  useEffect(() => {
    if (!isAutoSmsSyncEnabled) {
      return;
    }
    const interval = setInterval(() => {
      readAndCreateFromMessages(50, 'recent', true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAutoSmsSyncEnabled]);

  const renderSectionContent = () => {
    if (activeSection === 'Assests') {
      return (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Assests Dashboard</Text>
            <Text style={styles.heroSubtitle}>Track everything you own in one place.</Text>
            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Total Assests</Text>
                <Text style={styles.metricValue}>{assets.length}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Total Value</Text>
                <Text style={styles.metricValue}>{formatCurrency(totalAssetValue)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>Your Assests</Text>
          </View>

          {assets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No assests yet</Text>
              <Text style={styles.emptyText}>
                Tap Add Asset at the bottom and start tracking your net worth.
              </Text>
            </View>
          ) : (
            assets.map((asset) => (
              <View key={asset.id} style={styles.assetCard}>
                <Text style={styles.assetTitle}>{asset.title}</Text>
                <Text style={styles.assetValue}>{formatCurrency(asset.price)}</Text>
              </View>
            ))
          )}
        </>
      );
    }

    if (activeSection === 'Income') {
      return (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Income Dashboard</Text>
            <Text style={styles.heroSubtitle}>Track all income streams in one place.</Text>
            <View style={styles.metricRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Total Entries</Text>
                <Text style={styles.metricValue}>{incomes.length}</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Total Income</Text>
                <Text style={styles.metricValue}>{formatCurrency(totalIncomeValue)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>Your Income Entries</Text>
          </View>

          {incomes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No income added yet</Text>
              <Text style={styles.emptyText}>
                Tap Add Income at the bottom to start tracking your earnings.
              </Text>
            </View>
          ) : (
            incomes.map((income) => (
              <View key={income.id} style={styles.assetCard}>
                <Text style={styles.assetTitle}>{income.title}</Text>
                <Text style={styles.assetValue}>{formatCurrency(income.amount)}</Text>
              </View>
            ))
          )}
        </>
      );
    }

    if (activeSection === 'Transactions') {
      return (
        <TransactionsSection
          transactions={transactions}
          onAddTransaction={handleAddTransaction}
          onAssignCategory={handleAssignTransactionCategory}
          onDenyTransaction={handleDenyTransaction}
          onReadMessages={handleReadMessages}
          onReadAllMessages={handleReadAllMessages}
          isAutoSmsSyncEnabled={isAutoSmsSyncEnabled}
          onToggleAutoSmsSync={() => setIsAutoSmsSyncEnabled((prev) => !prev)}
          isReadingMessages={isReadingMessages}
          readStatus={readStatus}
        />
      );
    }

    if (activeSection !== 'Loans') {
      return (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>{activeSection}</Text>
          <Text style={styles.placeholderText}>
            This section will be added next. Your Loans section is fully ready.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.graphCard}>
          <Text style={styles.graphTitle}>Repayment Graph</Text>
          <Text style={styles.graphSubtitle}>How much paid vs remaining</Text>
          <View style={styles.pieSection}>
            <Svg width={150} height={150}>
              {(() => {
                const center = 75;
                const radius = 56;
                const strokeWidth = 16;
                const circumference = 2 * Math.PI * radius;
                const totalPrincipal = totals.principal || 1;
                const paidFraction = totals.principal > 0 ? totals.paidPrincipal / totalPrincipal : 0;
                const paidArc = circumference * paidFraction;
                return (
                  <>
                    <Circle
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke="rgba(196, 181, 253, 0.95)"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                    />
                    <Circle
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke="rgba(103, 232, 249, 0.95)"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={`${paidArc} ${circumference - paidArc}`}
                      transform={`rotate(-90 ${center} ${center})`}
                      strokeLinecap="round"
                    />
                  </>
                );
              })()}
            </Svg>
            <View style={styles.pieLegend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: 'rgba(103, 232, 249, 0.95)' }]} />
                <Text style={styles.legendText}>Paid Principal</Text>
                <Text style={styles.legendAmount}>{formatCurrency(totals.paidPrincipal)}</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: 'rgba(196, 181, 253, 0.95)' }]} />
                <Text style={styles.legendText}>Remaining Principal</Text>
                <Text style={styles.legendAmount}>{formatCurrency(totals.outstanding)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Active Loans Dashboard</Text>
          <Text style={styles.heroSubtitle}>Track repayments with clear insights.</Text>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Active Loans</Text>
              <Text style={styles.metricValue}>{loansWithStats.length}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Monthly EMI</Text>
              <Text style={styles.metricValue}>{formatCurrency(totals.monthlyEmi)}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Principal</Text>
              <Text style={styles.metricValue}>{formatCurrency(totals.principal)}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Total Payable</Text>
              <Text style={styles.metricValue}>{formatCurrency(totals.totalPayable)}</Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Outstanding</Text>
              <Text style={styles.metricValue}>{formatCurrency(totals.outstanding)}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Paid Interest</Text>
              <Text style={styles.metricValue}>{formatCurrency(totals.paidInterest)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>Your Active Loans</Text>
        </View>

        <View style={styles.projectionCard}>
          <Text style={styles.projectionTitle}>Current + Upcoming EMI Projection</Text>
          <Text style={styles.projectionSubtitle}>
            EMI split for current month and next months (principal + interest)
          </Text>
          {monthlyProjection.length === 0 ? (
            <Text style={styles.emptyText}>Add a loan to see month-wise projection.</Text>
          ) : (
            monthlyProjection.map((month) => (
              <View key={month.label} style={styles.projectionRow}>
                <Text style={styles.projectionMonth}>{month.label}</Text>
                <Text style={styles.projectionValue}>EMI: {formatCurrency(month.emi)}</Text>
                <Text style={styles.projectionValue}>
                  Principal: {formatCurrency(month.principal)}
                </Text>
                <Text style={styles.projectionValue}>
                  Interest: {formatCurrency(month.interest)}
                </Text>
              </View>
            ))
          )}
        </View>

        {loansWithStats.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No loans yet</Text>
            <Text style={styles.emptyText}>
              Tap Add Loan at the bottom to start tracking your first EMI plan.
            </Text>
          </View>
        ) : (
          loansWithStats.map((loan, index) => (
            <View key={loan.id} style={styles.loanCard}>
              <View style={styles.loanHeader}>
                <View>
                  <Text style={styles.loanTitle}>{loan.title}</Text>
                  <Text style={styles.loanSubtitle}>Loan #{loansWithStats.length - index}</Text>
                </View>
                <Text style={styles.loanBadge}>Active</Text>
              </View>
              <View style={styles.loanMetricsRow}>
                <View style={styles.loanMetricPill}>
                  <Text style={styles.loanMetricPillLabel}>Outstanding</Text>
                  <Text style={styles.loanMetricPillValue}>{formatCurrency(loan.outstanding)}</Text>
                </View>
                <View style={styles.loanMetricPill}>
                  <Text style={styles.loanMetricPillLabel}>Paid</Text>
                  <Text style={styles.loanMetricPillValue}>{formatCurrency(loan.paidAmount)}</Text>
                </View>
                <View style={styles.loanMetricPill}>
                  <Text style={styles.loanMetricPillLabel}>Paid Interest</Text>
                  <Text style={styles.loanMetricPillValue}>{formatCurrency(loan.paidInterest)}</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${loan.progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Principal repaid: {loan.progressPercent.toFixed(1)}% | EMIs paid: {loan.paidMonths}/
                {loan.tenureMonths}
              </Text>

              <View style={styles.loanGrid}>
                <Text style={styles.loanLabel}>Loan Amount</Text>
                <Text style={styles.loanValue}>{formatCurrency(loan.amount)}</Text>
                <Text style={styles.loanLabel}>First EMI Date</Text>
                <Text style={styles.loanValue}>{loan.firstEmiDate}</Text>
                <Text style={styles.loanLabel}>Tenure</Text>
                <Text style={styles.loanValue}>{loan.tenureMonths} months</Text>
                <Text style={styles.loanLabel}>Interest Rate</Text>
                <Text style={styles.loanValue}>{loan.interestRate}% p.a.</Text>
                <Text style={styles.loanLabel}>Monthly EMI</Text>
                <Text style={styles.loanValue}>{formatCurrency(loan.emi)}</Text>
              </View>
            </View>
          ))
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.bgBubbleOne} />
        <View style={styles.bgBubbleTwo} />
        <Text style={styles.title}>My Finance Hub</Text>
        <Text style={styles.subtitle}>Glass analytics for smarter loan tracking.</Text>

        <View style={styles.sectionTabs}>
          {(['Loans', 'Assests', 'Income', 'Transactions', 'Profile'] as SectionName[]).map((section) => (
            <Pressable
              key={section}
              style={[styles.tabButton, activeSection === section && styles.tabButtonActive]}
              onPress={() => setActiveSection(section)}
            >
              <Text style={[styles.tabText, activeSection === section && styles.tabTextActive]}>
                {section}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderSectionContent()}
        </ScrollView>

        {activeSection === 'Loans' ||
        activeSection === 'Assests' ||
        activeSection === 'Income' ? (
          <Pressable
            style={[styles.bottomButton, { bottom: Platform.OS === 'android' ? 32 : 16 }]}
            onPress={() => {
              if (activeSection === 'Loans') {
                setShowAddLoanModal(true);
                return;
              }
              if (activeSection === 'Assests') {
                setShowAddAssetModal(true);
                return;
              }
              if (activeSection === 'Income') {
                setShowAddIncomeModal(true);
                return;
              }
            }}
          >
            <Text style={styles.bottomButtonText}>
              {activeSection === 'Loans'
                ? '+ Add Loan'
                : activeSection === 'Assests'
                  ? '+ Add Asset'
                  : '+ Add Income'}
            </Text>
          </Pressable>
        ) : null}

        <Modal animationType="slide" transparent visible={showAddLoanModal}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              style={styles.modalCard}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Text style={styles.modalTitle}>Add New Loan</Text>
              <Text style={styles.modalSubtitle}>Fill in the details below.</Text>

              <Text style={styles.label}>Loan Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Home Loan - HDFC"
                placeholderTextColor="#94a3b8"
                value={loanTitle}
                onChangeText={setLoanTitle}
              />

              <Text style={styles.label}>Loan Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 500000"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.label}>First EMI Date</Text>
              <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                <Text style={firstEmiDate ? styles.dateInputValue : styles.dateInputPlaceholder}>
                  {firstEmiDate || 'Select date from calendar'}
                </Text>
              </Pressable>
              {showDatePicker ? (
                <View style={styles.datePickerWrap}>
                  <DateTimePicker
                    value={firstEmiDate ? new Date(firstEmiDate) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                  />
                  {Platform.OS === 'ios' ? (
                    <Pressable style={styles.dateDoneBtn} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.dateDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.label}>Tenure (months)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 60"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                value={tenure}
                onChangeText={setTenure}
              />

              <Text style={styles.label}>Interest Rate (%)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 9.5"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={interestRate}
                onChangeText={setInterestRate}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowAddLoanModal(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddLoan}>
                  <Text style={styles.saveBtnText}>Save Loan</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal animationType="slide" transparent visible={showAddAssetModal}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              style={styles.modalCard}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Text style={styles.modalTitle}>Add New Asset</Text>
              <Text style={styles.modalSubtitle}>Fill in asset details below.</Text>

              <Text style={styles.label}>Asset Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Gold, Land, Car"
                placeholderTextColor="#94a3b8"
                value={assetTitle}
                onChangeText={setAssetTitle}
              />

              <Text style={styles.label}>Asset Price</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 250000"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={assetPrice}
                onChangeText={setAssetPrice}
              />

              {assetError ? <Text style={styles.errorText}>{assetError}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowAddAssetModal(false);
                    resetAssetForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddAsset}>
                  <Text style={styles.saveBtnText}>Save Asset</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal animationType="slide" transparent visible={showAddIncomeModal}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              style={styles.modalCard}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <Text style={styles.modalTitle}>Add New Income</Text>
              <Text style={styles.modalSubtitle}>Fill in income details below.</Text>

              <Text style={styles.label}>Income Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Salary, Freelance, Rent"
                placeholderTextColor="#94a3b8"
                value={incomeTitle}
                onChangeText={setIncomeTitle}
              />

              <Text style={styles.label}>Income Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 85000"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                value={incomeAmount}
                onChangeText={setIncomeAmount}
              />

              {incomeError ? <Text style={styles.errorText}>{incomeError}</Text> : null}

              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => {
                    setShowAddIncomeModal(false);
                    resetIncomeForm();
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddIncome}>
                  <Text style={styles.saveBtnText}>Save Income</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <StatusBar style="dark" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#091226',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bgBubbleOne: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  bgBubbleTwo: {
    position: 'absolute',
    top: 220,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(168, 85, 247, 0.17)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#cbd5e1',
  },
  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    padding: 4,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.25)',
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabText: {
    color: '#dbeafe',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  graphCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  graphTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  graphSubtitle: {
    color: '#cbd5e1',
    marginTop: 3,
    marginBottom: 12,
  },
  pieSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pieLegend: {
    flex: 1,
    marginLeft: 10,
    gap: 10,
  },
  legendRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 6,
  },
  legendText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  legendAmount: {
    color: '#f8fafc',
    marginTop: 4,
    fontWeight: '700',
  },
  projectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  projectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  projectionSubtitle: {
    color: '#cbd5e1',
    marginTop: 2,
    marginBottom: 10,
    fontSize: 12,
  },
  projectionRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  projectionMonth: {
    color: '#93c5fd',
    fontWeight: '700',
    marginBottom: 6,
  },
  projectionValue: {
    color: '#f8fafc',
    fontSize: 12,
    marginBottom: 2,
  },
  heroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#cbd5e1',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  metricLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  metricValue: {
    marginTop: 6,
    color: '#f8fafc',
    fontWeight: '700',
  },
  sectionHeadingRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#cbd5e1',
    lineHeight: 20,
  },
  loanCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  loanTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  loanSubtitle: {
    marginTop: 2,
    color: '#bfdbfe',
    fontSize: 12,
  },
  loanBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    color: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  loanMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  loanMetricPill: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  loanMetricPillLabel: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  loanMetricPillValue: {
    color: '#f8fafc',
    marginTop: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22d3ee',
    borderRadius: 999,
  },
  progressText: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 8,
  },
  loanGrid: {
    gap: 4,
  },
  loanLabel: {
    color: '#bfdbfe',
    fontSize: 12,
    marginTop: 6,
  },
  loanValue: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  assetCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  assetTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  assetValue: {
    color: '#67e8f9',
    marginTop: 6,
    fontWeight: '700',
    fontSize: 14,
  },
  bottomButton: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.9)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  bottomButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  label: {
    marginTop: 10,
    marginBottom: 4,
    color: '#dbeafe',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    color: '#f8fafc',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  dateInputPlaceholder: {
    color: '#94a3b8',
  },
  dateInputValue: {
    color: '#f8fafc',
  },
  datePickerWrap: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    overflow: 'hidden',
  },
  dateDoneBtn: {
    alignSelf: 'flex-end',
    margin: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.9)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dateDoneText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    color: '#fecaca',
    fontWeight: '600',
  },
  placeholderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    padding: 16,
  },
  placeholderTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  placeholderText: {
    color: '#cbd5e1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 4,
    color: '#cbd5e1',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 6,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelBtn: {
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
  cancelBtnText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: 'rgba(34, 211, 238, 0.9)',
  },
  saveBtnText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
