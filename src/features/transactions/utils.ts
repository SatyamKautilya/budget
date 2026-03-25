import { SmsMessage, Transaction, TransactionCategory, TransactionType } from './types';

const amountRegex = /(?:rs\.?|inr|\u20b9)?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i;

const normalize = (value: string) => value.toUpperCase();

export const detectCategoryId = (message: string, categories: TransactionCategory[]): string | null => {
  const content = normalize(message);
  const matched = categories.find((c) => c.identifier && content.includes(c.identifier.toUpperCase()));
  return matched?.id ?? null;
};

export const detectType = (message: string): TransactionType => {
  const content = normalize(message);
  if (content.includes('CREDITED') || content.includes('CR ') || content.includes('CREDIT')) {
    return 'credit';
  }
  return 'debit';
};

export const parseAmount = (message: string): number | null => {
  const match = message.match(amountRegex);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(',', ''));
  return Number.isFinite(amount) ? amount : null;
};

export const messageToTransaction = (
  message: SmsMessage,
  categories: TransactionCategory[]
): Transaction | null => {
  const amount = parseAmount(message.body);
  if (!amount || amount <= 0) return null;

  const categoryId = detectCategoryId(message.body, categories);
  const fallbackTitle = message.address ? `SMS from ${message.address}` : 'SMS Transaction';

  return {
    id: `sms-${message.id}`,
    title: fallbackTitle,
    amount,
    type: detectType(message.body),
    categoryId,
    source: 'sms',
    smsMessageId: message.id,
    rawMessage: message.body,
    createdAt: new Date(message.date).toISOString(),
  };
};
