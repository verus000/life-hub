import { CATEGORIES } from './categories';
import { get, reminderCycle, set } from './model';
import { clone } from './records';
import type { Item, ItemInput } from './types';

export function initialFormValues(category: string, item: Item | null): Record<string, string> {
  return Object.fromEntries(CATEGORIES[category].fields.map((field) => {
    let value = item ? String(get(item, field.key)) : field.default || '';
    if (item && !value && field.key === 'detail.reminderCycle') value = reminderCycle(item);
    if (!value && field.key === 'currency') value = 'CNY';
    return [field.key, value];
  }));
}

export function collectFormValues(category: string, values: Record<string, string>, item: Item | null): ItemInput {
  const draft: ItemInput = { category, detail: clone(item?.detail || {}) };
  for (const field of CATEGORIES[category].fields) {
    const raw = values[field.key] ?? '';
    set(draft as Item, field.key, field.type === 'number' ? raw === '' ? null : Number(raw) : raw);
  }
  return draft;
}
