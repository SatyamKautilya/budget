import { TransactionCategory } from './types';

export const DEFAULT_CATEGORIES: TransactionCategory[] = [
  { id: 'salary', name: 'Salary', identifier: 'SAL' },
  { id: 'food', name: 'Food', identifier: 'FOOD' },
  { id: 'rent', name: 'Rent', identifier: 'RENT' },
  { id: 'emi', name: 'Loan EMI', identifier: 'EMI' },
  { id: 'shopping', name: 'Shopping', identifier: 'SHOP' },
  { id: 'fuel', name: 'Fuel', identifier: 'FUEL' },
];
