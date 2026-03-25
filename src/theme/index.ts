export { C } from './colors';

export const formatCurrency = (value: number) =>
  `\u20B9 ${value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
