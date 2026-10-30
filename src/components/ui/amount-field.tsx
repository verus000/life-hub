'use client';

import { CURRENCIES } from '@/lib/model';
import { Input } from './input';
import { SelectField } from './select-field';

const CURRENCY_OPTIONS = CURRENCIES.map((c): [string, string] => [c, c]);

/* 金额 + 币种合成一个输入组：左侧数字，右侧币种下拉。 */
export function AmountField({ id, label, amount, currency, onAmount, onCurrency }: {
  id: string;
  label: string;
  amount: string;
  currency: string;
  onAmount: (value: string) => void;
  onCurrency: (value: string) => void;
}) {
  return <div className="flex min-w-0">
    <Input id={id} type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={amount}
      onChange={(e) => onAmount(e.target.value)} className="min-w-0 flex-1 rounded-r-none focus-visible:z-10" />
    <SelectField label={label + '币种'} value={currency || 'CNY'} onChange={onCurrency} options={CURRENCY_OPTIONS}
      className="w-[88px] shrink-0 rounded-l-none border-l-0 focus-visible:z-10" />
  </div>;
}
