'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const EMPTY = '__life_hub_empty__';
type SelectFieldProps = { id?: string; label: string; value: string; onChange: (value: string) => void; options: [string, string][]; allowEmpty?: boolean; disabled?: boolean };

export function SelectField({ id, label, value, onChange, options, allowEmpty = false, disabled }: SelectFieldProps) {
  const known = options.some(([key]) => key === value);
  return <Select value={value || EMPTY} onValueChange={(next) => onChange(next === EMPTY ? '' : next)} disabled={disabled}>
    <SelectTrigger id={id} aria-label={label}><SelectValue placeholder="请选择" /></SelectTrigger>
    <SelectContent>
      {(allowEmpty || !value) && <SelectItem value={EMPTY}>不设置</SelectItem>}
      {!known && value && <SelectItem value={value}>{value}</SelectItem>}
      {options.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}
    </SelectContent>
  </Select>;
}
