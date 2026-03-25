import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Loan = {
  id: string;
  lender: string;
  amount: number;
  interestRate?: number;
  dueDate?: string;
};

export default function App() {
  const [lender, setLender] = useState('');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);

  const totalLoaned = useMemo(
    () => loans.reduce((sum, loan) => sum + loan.amount, 0),
    [loans]
  );

  const handleAddLoan = () => {
    const parsedAmount = Number(amount);
    const parsedRate = interestRate.trim() ? Number(interestRate) : undefined;

    if (!lender.trim()) {
      setError('Please add who gave the loan.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    if (parsedRate !== undefined && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      setError('Please enter a valid interest rate.');
      return;
    }

    const loan: Loan = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      lender: lender.trim(),
      amount: parsedAmount,
      interestRate: parsedRate,
      dueDate: dueDate.trim() || undefined,
    };

    setLoans((prevLoans) => [loan, ...prevLoans]);
    setLender('');
    setAmount('');
    setInterestRate('');
    setDueDate('');
    setError('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Loan Tracker</Text>
        <Text style={styles.subtitle}>Add your loans and track total borrowed amount.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Lender Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. SBI Bank"
            value={lender}
            onChangeText={setLender}
          />

          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 50000"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.label}>Interest Rate (%)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 12"
            keyboardType="decimal-pad"
            value={interestRate}
            onChangeText={setInterestRate}
          />

          <Text style={styles.label}>Due Date</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2026-12-31"
            value={dueDate}
            onChangeText={setDueDate}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.addButton} onPress={handleAddLoan}>
            <Text style={styles.addButtonText}>Add Loan</Text>
          </Pressable>
        </View>

        <Text style={styles.totalText}>Total Borrowed: Rs {totalLoaned.toFixed(2)}</Text>

        <FlatList
          data={loans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.loanList}
          ListEmptyComponent={<Text style={styles.emptyText}>No loans added yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.loanItem}>
              <Text style={styles.loanLender}>{item.lender}</Text>
              <Text style={styles.loanMeta}>Amount: Rs {item.amount.toFixed(2)}</Text>
              <Text style={styles.loanMeta}>
                Interest: {item.interestRate !== undefined ? `${item.interestRate}%` : 'N/A'}
              </Text>
              <Text style={styles.loanMeta}>Due: {item.dueDate ?? 'N/A'}</Text>
            </View>
          )}
        />
        <StatusBar style="dark" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: '#475569',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  errorText: {
    marginTop: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  addButton: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  loanList: {
    paddingBottom: 16,
  },
  emptyText: {
    color: '#64748b',
    marginTop: 8,
  },
  loanItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loanLender: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  loanMeta: {
    marginTop: 4,
    color: '#475569',
  },
});
