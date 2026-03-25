import { Loan, LoanStats } from '../../types';

export const calculateEmi = (principal: number, annualRate: number, months: number) => {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
};

const getPaidMonths = (firstDate: string, tenure: number) => {
  const d = new Date(firstDate);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  if (now < d) return 0;
  const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  const extra = now.getDate() >= d.getDate() ? 1 : 0;
  return Math.max(0, Math.min(tenure, diff + extra));
};

export const calculateLoanStats = (loan: Loan): LoanStats => {
  const r = loan.interestRate / 12 / 100;
  const paidMonths = getPaidMonths(loan.firstEmiDate, loan.tenureMonths);
  let outstanding = loan.amount;
  let paidInterest = 0;
  let paidPrincipal = 0;

  for (let m = 0; m < paidMonths; m++) {
    const interest = r === 0 ? 0 : outstanding * r;
    let principal = loan.emi - interest;
    if (principal > outstanding || m === loan.tenureMonths - 1) principal = outstanding;
    if (principal < 0) principal = 0;
    outstanding -= principal;
    paidInterest += interest;
    paidPrincipal += principal;
  }

  outstanding = Math.max(0, outstanding);
  return {
    ...loan,
    paidMonths,
    paidAmount: paidPrincipal + paidInterest,
    paidInterest,
    paidPrincipal,
    outstanding,
    progressPercent: loan.amount === 0 ? 0 : Math.min(100, (paidPrincipal / loan.amount) * 100),
  };
};

type AmortRow = { label: string; emi: number; principal: number; interest: number };

export const buildProjection = (loans: Loan[], monthsAhead = 6): AmortRow[] => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const byMonth: Record<string, AmortRow> = {};

  for (const loan of loans) {
    const first = new Date(loan.firstEmiDate);
    if (Number.isNaN(first.getTime())) continue;
    const r = loan.interestRate / 12 / 100;
    let bal = loan.amount;

    for (let m = 0; m < loan.tenureMonths; m++) {
      const dueDate = new Date(first.getFullYear(), first.getMonth() + m, first.getDate());
      const interest = r === 0 ? 0 : bal * r;
      let principal = loan.emi - interest;
      if (principal > bal || m === loan.tenureMonths - 1) principal = bal;
      if (principal < 0) principal = 0;
      const emi = principal + interest;
      bal = Math.max(0, bal - principal);

      if (dueDate >= start) {
        const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        if (!byMonth[key]) {
          byMonth[key] = {
            label: dueDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            emi: 0,
            principal: 0,
            interest: 0,
          };
        }
        byMonth[key].emi += emi;
        byMonth[key].principal += principal;
        byMonth[key].interest += interest;
      }
    }
  }

  return Object.values(byMonth)
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, monthsAhead);
};
