import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TRANSACTION_CATEGORIES } from './constants';
import { Transaction, TransactionType } from './types';

type AddTransactionInput = {
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
};

type Props = {
  transactions: Transaction[];
  onAddTransaction: (input: AddTransactionInput) => void;
  onAssignCategory: (transactionId: string, categoryId: string) => void;
  onDenyTransaction: (transactionId: string) => void;
  onReadMessages: () => Promise<void>;
  onReadAllMessages: () => Promise<void>;
  isAutoSmsSyncEnabled: boolean;
  onToggleAutoSmsSync: () => void;
  isReadingMessages: boolean;
  readStatus: string;
};

export default function TransactionsSection({
  transactions,
  onAddTransaction,
  onAssignCategory,
  onDenyTransaction,
  onReadMessages,
  onReadAllMessages,
  isAutoSmsSyncEnabled,
  onToggleAutoSmsSync,
  isReadingMessages,
  readStatus,
}: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('debit');
  const [categoryId, setCategoryId] = useState<string | null>(TRANSACTION_CATEGORIES[0]?.id ?? null);
  const [error, setError] = useState('');

  const totals = useMemo(() => {
    const credit = transactions
      .filter((item) => item.type === 'credit')
      .reduce((sum, item) => sum + item.amount, 0);
    const debit = transactions
      .filter((item) => item.type === 'debit')
      .reduce((sum, item) => sum + item.amount, 0);
    return { credit, debit, net: credit - debit };
  }, [transactions]);

  const unassigned = transactions.filter((item) => !item.categoryId);
  const categorized = transactions.filter((item) => Boolean(item.categoryId));
  const formatCurrency = (value: number) => `Rs ${value.toFixed(2)}`;

  const handleAdd = () => {
    const parsedAmount = Number(amount);
    if (!title.trim()) {
      setError('Please add transaction title.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please add a valid amount.');
      return;
    }

    onAddTransaction({
      title: title.trim(),
      amount: parsedAmount,
      type,
      categoryId,
    });
    setTitle('');
    setAmount('');
    setType('debit');
    setCategoryId(TRANSACTION_CATEGORIES[0]?.id ?? null);
    setError('');
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>Transactions Dashboard</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Credit</Text>
            <Text style={styles.metricValue}>{formatCurrency(totals.credit)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Debit</Text>
            <Text style={styles.metricValue}>{formatCurrency(totals.debit)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Net</Text>
            <Text style={styles.metricValue}>{formatCurrency(totals.net)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Read Device Messages</Text>
        <Text style={styles.subtle}>
          Add category identifiers in SMS content (example: SAL, FOOD, EMI). Unmatched SMS goes to
          unassigned pool.
        </Text>
        <Pressable style={styles.actionBtn} onPress={onReadMessages} disabled={isReadingMessages}>
          <Text style={styles.actionText}>
            {isReadingMessages ? 'Reading messages...' : 'Read Recent SMS and Create Entries'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onReadAllMessages} disabled={isReadingMessages}>
          <Text style={styles.secondaryText}>Read All Past SMS and Create Entries</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onToggleAutoSmsSync}>
          <Text style={styles.secondaryText}>
            {isAutoSmsSyncEnabled ? 'Auto SMS Sync: ON' : 'Auto SMS Sync: OFF'}
          </Text>
        </Pressable>
        {readStatus ? <Text style={styles.subtle}>{readStatus}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Add Transaction</Text>
        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Amount"
          placeholderTextColor="#94a3b8"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={styles.toggleRow}>
          {(['debit', 'credit'] as TransactionType[]).map((option) => (
            <Pressable
              key={option}
              style={[styles.toggleBtn, type === option && styles.toggleBtnActive]}
              onPress={() => setType(option)}
            >
              <Text style={styles.toggleText}>{option.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.subtle}>Category</Text>
        <View style={styles.categoryWrap}>
          {TRANSACTION_CATEGORIES.map((category) => (
            <Pressable
              key={category.id}
              style={[styles.categoryChip, categoryId === category.id && styles.categoryChipActive]}
              onPress={() => setCategoryId(category.id)}
            >
              <Text style={styles.categoryChipText}>{category.name}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.actionBtn} onPress={handleAdd}>
          <Text style={styles.actionText}>Add Transaction</Text>
        </Pressable>
      </View>

      {unassigned.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Unassigned Pool</Text>
          {unassigned.map((item) => (
            <View key={item.id} style={styles.rowCard}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
              <Text style={styles.subtle}>Assign category</Text>
              <View style={styles.categoryWrap}>
                {TRANSACTION_CATEGORIES.map((category) => (
                  <Pressable
                    key={`${item.id}-${category.id}`}
                    style={styles.categoryChip}
                    onPress={() => onAssignCategory(item.id, category.id)}
                  >
                    <Text style={styles.categoryChipText}>{category.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.denyBtn} onPress={() => onDenyTransaction(item.id)}>
                <Text style={styles.denyText}>Deny Entry</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.heading}>All Categorized Transactions</Text>
        {categorized.length === 0 ? (
          <Text style={styles.subtle}>No categorized entries yet.</Text>
        ) : (
          categorized.map((item) => {
            const category = TRANSACTION_CATEGORIES.find((cat) => cat.id === item.categoryId);
            return (
              <View key={item.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.subtle}>
                  {item.type.toUpperCase()} | {category?.name ?? 'Unknown'}
                </Text>
                <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            );
          })
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 14,
    marginBottom: 12,
  },
  heading: {
    color: '#f8fafc',
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 16,
  },
  subtle: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    backgroundColor: 'rgba(15,23,42,0.35)',
    padding: 10,
  },
  metricLabel: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  metricValue: {
    color: '#f8fafc',
    fontWeight: '700',
    marginTop: 4,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.35)',
    color: '#f8fafc',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    paddingVertical: 10,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.35)',
    borderColor: 'rgba(34,211,238,0.8)',
  },
  toggleText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  actionBtn: {
    backgroundColor: 'rgba(34,211,238,0.9)',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 4,
  },
  actionText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.8)',
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 8,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  secondaryText: {
    color: '#67e8f9',
    fontWeight: '700',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(34,211,238,0.35)',
    borderColor: 'rgba(34,211,238,0.8)',
  },
  categoryChipText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  rowCard: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.35)',
    padding: 10,
    marginBottom: 8,
  },
  rowTitle: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  rowAmount: {
    color: '#67e8f9',
    marginTop: 4,
    fontWeight: '700',
  },
  error: {
    color: '#fecaca',
    marginBottom: 8,
    fontWeight: '600',
  },
  denyBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.75)',
    backgroundColor: 'rgba(127,29,29,0.35)',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  denyText: {
    color: '#fecaca',
    fontWeight: '700',
    fontSize: 12,
  },
});
