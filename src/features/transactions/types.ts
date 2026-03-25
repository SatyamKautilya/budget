export type TransactionType = 'debit' | 'credit';

export type TransactionCategory = {
  id: string;
  name: string;
  identifier: string;
};

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  source: 'manual' | 'sms';
  smsMessageId?: string;
  rawMessage?: string;
  createdAt: string;
};

export type SmsMessage = {
  id: string;
  address: string;
  body: string;
  date: number;
};
