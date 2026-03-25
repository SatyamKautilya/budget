import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LentLoan } from '../../types';
import { formatCurrency } from '../../theme';
import { C } from '../../theme/colors';
import GlassCard from '../../components/GlassCard';
import SectionHeading from '../../components/SectionHeading';
import EmptyState from '../../components/EmptyState';
import FormInput from '../../components/FormInput';
import ActionButton from '../../components/ActionButton';
import BottomSheet from '../../components/BottomSheet';

type Props = {
  /** Increment from parent (e.g. FAB) to open the "new loan" sheet. */
  openAddSignal?: number;
  lentLoans: LentLoan[];
  onAddLoan: (input: { borrowerName: string; principal: number; notes?: string }) => void;
  onUpdateLoan: (loanId: string, input: { borrowerName: string; principal: number; notes?: string }) => void;
  onDeleteLoan: (loanId: string) => void;
  onAddPayment: (loanId: string, input: { amount: number; note?: string }) => void;
  onUpdatePayment: (loanId: string, paymentId: string, input: { amount: number; note?: string }) => void;
  onDeletePayment: (loanId: string, paymentId: string) => void;
};

function totalRepaid(loan: LentLoan) {
  return loan.payments.reduce((s, p) => s + p.amount, 0);
}

export default function LentSection({
  openAddSignal = 0,
  lentLoans,
  onAddLoan,
  onUpdateLoan,
  onDeleteLoan,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
}: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editLoanId, setEditLoanId] = useState<string | null>(null);
  const [payLoanId, setPayLoanId] = useState<string | null>(null);
  const [editPayId, setEditPayId] = useState<string | null>(null);

  const [borrower, setBorrower] = useState('');
  const [principalStr, setPrincipalStr] = useState('');
  const [notes, setNotes] = useState('');
  const [formErr, setFormErr] = useState('');

  const [payAmountStr, setPayAmountStr] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');

  const sorted = useMemo(
    () => [...lentLoans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [lentLoans]
  );

  const openAdd = () => {
    setBorrower('');
    setPrincipalStr('');
    setNotes('');
    setFormErr('');
    setShowAdd(true);
  };

  useEffect(() => {
    if (openAddSignal > 0) {
      setEditLoanId(null);
      openAdd();
    }
  }, [openAddSignal]);

  const openEdit = (loan: LentLoan) => {
    setEditLoanId(loan.id);
    setBorrower(loan.borrowerName);
    setPrincipalStr(String(loan.principal));
    setNotes(loan.notes ?? '');
    setFormErr('');
  };

  const submitLoan = () => {
    const p = Number(principalStr);
    if (!borrower.trim()) {
      setFormErr('Enter borrower name.');
      return;
    }
    if (!Number.isFinite(p) || p <= 0) {
      setFormErr('Enter a valid principal amount.');
      return;
    }
    const repaid = editLoanId ? totalRepaid(lentLoans.find((l) => l.id === editLoanId)!) : 0;
    if (editLoanId && p < repaid) {
      setFormErr(`Principal cannot be less than total repaid (${formatCurrency(repaid)}).`);
      return;
    }
    const payload = { borrowerName: borrower.trim(), principal: p, notes: notes.trim() || undefined };
    if (editLoanId) onUpdateLoan(editLoanId, payload);
    else onAddLoan(payload);
    setShowAdd(false);
    setEditLoanId(null);
  };

  const openPay = (loanId: string) => {
    setPayLoanId(loanId);
    setEditPayId(null);
    setPayAmountStr('');
    setPayNote('');
    setPayErr('');
  };

  const openEditPay = (loanId: string, paymentId: string, loan: LentLoan) => {
    const pay = loan.payments.find((x) => x.id === paymentId);
    if (!pay) return;
    setPayLoanId(loanId);
    setEditPayId(paymentId);
    setPayAmountStr(String(pay.amount));
    setPayNote(pay.note ?? '');
    setPayErr('');
  };

  const submitPayment = () => {
    if (!payLoanId) return;
    const amt = Number(payAmountStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPayErr('Enter a valid amount.');
      return;
    }
    const loan = lentLoans.find((l) => l.id === payLoanId);
    if (!loan) return;
    const other = loan.payments.filter((p) => p.id !== editPayId).reduce((s, x) => s + x.amount, 0);
    if (other + amt > loan.principal) {
      setPayErr(`Total payments cannot exceed principal (${formatCurrency(loan.principal)}).`);
      return;
    }
    if (editPayId) onUpdatePayment(payLoanId, editPayId, { amount: amt, note: payNote.trim() || undefined });
    else onAddPayment(payLoanId, { amount: amt, note: payNote.trim() || undefined });
    setPayLoanId(null);
    setEditPayId(null);
  };

  const loanFormVisible = showAdd || editLoanId !== null;

  return (
    <>
      <SectionHeading title="Money lent to others" subtitle="Track principal and repayments — no interest or EMI math." />

      {sorted.length === 0 ? (
        <EmptyState title="Nothing here yet" message="Tap the button below to add a loan you gave someone." />
      ) : (
        sorted.map((loan) => {
          const repaid = totalRepaid(loan);
          const out = loan.principal - repaid;
          return (
            <GlassCard key={loan.id}>
              <View style={s.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.borrower}>{loan.borrowerName}</Text>
                  {loan.notes ? <Text style={s.loanNotes}>{loan.notes}</Text> : null}
                </View>
                <Pressable
                  style={s.delLoan}
                  onPress={() => onDeleteLoan(loan.id)}
                  accessibilityLabel={`Delete loan to ${loan.borrowerName}`}
                >
                  <Text style={s.delLoanText}>Delete</Text>
                </Pressable>
              </View>

              <View style={s.metrics}>
                <View style={s.metric}>
                  <Text style={s.metricLab}>Lent</Text>
                  <Text style={s.metricVal}>{formatCurrency(loan.principal)}</Text>
                </View>
                <View style={s.metric}>
                  <Text style={s.metricLab}>Repaid</Text>
                  <Text style={s.metricVal}>{formatCurrency(repaid)}</Text>
                </View>
                <View style={s.metric}>
                  <Text style={s.metricLab}>Outstanding</Text>
                  <Text style={[s.metricVal, out > 0 && s.out]}>{formatCurrency(out)}</Text>
                </View>
              </View>

              <Text style={s.payHeading}>Payments</Text>
              {loan.payments.length === 0 ? (
                <Text style={s.noPay}>No payments recorded yet.</Text>
              ) : (
                loan.payments
                  .slice()
                  .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
                  .map((p) => (
                    <View key={p.id} style={s.payRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.payAmt}>{formatCurrency(p.amount)}</Text>
                        {p.note ? <Text style={s.payNote}>{p.note}</Text> : null}
                        <Text style={s.payDate}>
                          {new Date(p.recordedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={s.payActions}>
                        <Pressable onPress={() => openEditPay(loan.id, p.id, loan)} accessibilityLabel="Edit payment">
                          <Text style={s.link}>Edit</Text>
                        </Pressable>
                        <Pressable onPress={() => onDeletePayment(loan.id, p.id)} accessibilityLabel="Delete payment">
                          <Text style={s.linkDanger}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
              )}

              <Pressable style={s.addPayBtn} onPress={() => openPay(loan.id)} accessibilityLabel="Add payment">
                <Text style={s.addPayText}>+ Record payment</Text>
              </Pressable>

              <Pressable style={s.editLoanBtn} onPress={() => openEdit(loan)} accessibilityLabel="Edit loan">
                <Text style={s.editLoanText}>Edit loan details</Text>
              </Pressable>
            </GlassCard>
          );
        })
      )}

      <BottomSheet visible={loanFormVisible} onClose={() => { setShowAdd(false); setEditLoanId(null); }}>
        <SectionHeading title={editLoanId ? 'Edit loan' : 'New loan given'} subtitle="Who borrowed and how much?" />
        <FormInput label="Borrower name" value={borrower} onChangeText={setBorrower} placeholder="e.g. Alex" />
        <FormInput label="Principal amount" value={principalStr} onChangeText={setPrincipalStr} keyboardType="decimal-pad" placeholder="0" />
        <FormInput label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Context, due date…" />
        {formErr ? <Text style={s.err}>{formErr}</Text> : null}
        <ActionButton label={editLoanId ? 'Save' : 'Add'} onPress={submitLoan} />
      </BottomSheet>

      <BottomSheet visible={payLoanId !== null} onClose={() => { setPayLoanId(null); setEditPayId(null); }}>
        <SectionHeading title={editPayId ? 'Edit payment' : 'Record payment'} subtitle="Amount received back" />
        <FormInput label="Amount" value={payAmountStr} onChangeText={setPayAmountStr} keyboardType="decimal-pad" />
        <FormInput label="Note (optional)" value={payNote} onChangeText={setPayNote} />
        {payErr ? <Text style={s.err}>{payErr}</Text> : null}
        <ActionButton label={editPayId ? 'Save payment' : 'Add payment'} onPress={submitPayment} />
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  borrower: { color: C.text, fontSize: 17, fontWeight: '700' },
  loanNotes: { color: C.textMuted, fontSize: 12, marginTop: 4 },
  delLoan: { paddingHorizontal: 8, paddingVertical: 4 },
  delLoanText: { color: C.red, fontWeight: '700', fontSize: 12 },

  metrics: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: {
    flex: 1, backgroundColor: C.inputBg, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.borderLight,
  },
  metricLab: { color: C.textMuted, fontSize: 10 },
  metricVal: { color: C.text, fontWeight: '700', fontSize: 12, marginTop: 4 },
  out: { color: C.cyan },

  payHeading: { color: C.textSubtle, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  noPay: { color: C.textMuted, fontSize: 12, marginBottom: 8 },
  payRow: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  payAmt: { color: C.text, fontWeight: '700', fontSize: 14 },
  payNote: { color: C.textSubtle, fontSize: 12, marginTop: 2 },
  payDate: { color: C.textMuted, fontSize: 10, marginTop: 4 },
  payActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  link: { color: C.accent, fontWeight: '700', fontSize: 12 },
  linkDanger: { color: C.red, fontWeight: '700', fontSize: 12 },

  addPayBtn: {
    marginTop: 10, backgroundColor: C.accentSoft, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  addPayText: { color: C.accent, fontWeight: '800', fontSize: 14 },
  editLoanBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
  editLoanText: { color: C.textMuted, fontWeight: '600', fontSize: 13 },

  err: { color: C.red, fontWeight: '600', marginBottom: 8 },
});
