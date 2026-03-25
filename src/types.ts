export type SectionName = 'Loans' | 'Assets' | 'Income' | 'Txns' | 'Budget' | 'Lent' | 'Profile';

/** Money you lent to someone — simple principal + payment log (no EMI math). */
export type LentPayment = {
  id: string;
  amount: number;
  note?: string;
  recordedAt: string;
};

export type LentLoan = {
  id: string;
  borrowerName: string;
  principal: number;
  payments: LentPayment[];
  notes?: string;
  createdAt: string;
};

/** categoryId → allocated amount */
export type BudgetAllocation = Record<string, number>;

export type BudgetData = {
  defaultBudget: BudgetAllocation;
  monthlyBudgets: Record<string, BudgetAllocation>;
};

export type Loan = {
  id: string;
  title: string;
  amount: number;
  firstEmiDate: string;
  tenureMonths: number;
  interestRate: number;
  emi: number;
  totalPayable: number;
};

export type LoanStats = Loan & {
  paidMonths: number;
  paidAmount: number;
  paidInterest: number;
  paidPrincipal: number;
  outstanding: number;
  progressPercent: number;
};

export type Asset = {
  id: string;
  title: string;
  price: number;
};

export type Income = {
  id: string;
  title: string;
  amount: number;
};
