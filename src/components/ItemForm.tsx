'use client';

/* 添加/编辑条目表单：由 Model.CATEGORIES 的字段定义驱动渲染 */

import { useId, useState } from 'react';
import { CATEGORIES, get, reminderCycle, set } from '@/lib/model';
import type { FieldDef } from '@/lib/model';
import { clone, validate } from '@/lib/records';
import type { Item, ItemInput } from '@/lib/types';
import { Btn, Modal } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { SelectField } from '@/components/ui/select-field';
import { CountryCombobox } from '@/components/ui/country-combobox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const PRIMARY_KEYS: Record<string, string[]> = {
  phone: ['title', 'provider', 'detail.country', 'detail.strategy', 'nextDate', 'detail.reminderCycle'],
  broadband: ['title', 'amount', 'cycle', 'nextDate', 'detail.contractDate'],
  parking: ['title', 'provider', 'detail.slot', 'amount', 'cycle', 'nextDate'],
  asset: ['title', 'detail.assetType', 'amount', 'currency'],
};
const EXTRA_LABELS: Record<string, string> = {
  phone: '费用、激活日期与备注',
  broadband: '运营商、地址与其他信息',
  parking: '卡片、缴费渠道与备注',
  asset: '机构、复核日期与备注',
};

function FieldRow({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  const fieldId = useId();
  let control: React.ReactNode;
  if (f.type === 'select') {
    control = <SelectField id={fieldId} label={f.label} value={value} onChange={onChange} options={f.options || []} allowEmpty />;
  } else if (f.type === 'textarea') {
    control = <Textarea id={fieldId} value={value} placeholder={f.placeholder || ''} rows={3} onChange={(e) => onChange(e.target.value)} />;
  } else if (f.type === 'country') {
    control = <CountryCombobox id={fieldId} value={value} onChange={onChange} />;
  } else if (f.type === 'date') {
    control = <DatePicker id={fieldId} label={f.label} value={value} onChange={onChange} />;
  } else {
    control = <>
      <Input id={fieldId} type={f.type === 'number' ? 'number' : 'text'} step={f.type === 'number' ? '0.01' : undefined} value={value} placeholder={f.placeholder || ''} onChange={(e) => onChange(e.target.value)} />
      {f.type === 'suggest' && <div className="mt-2 flex flex-wrap gap-1.5">
        {(f.presets || []).map((preset) => <Button key={preset} size="xs" variant="secondary" onClick={() => onChange(preset)}>{preset}</Button>)}
      </div>}
    </>;
  }
  return <div className={f.full ? 'sm:col-span-2' : ''}>
    <Label htmlFor={fieldId} className="mb-2.5 block">{f.label}{f.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}</Label>
    {control}
  </div>;
}

export function ItemForm({
  category,
  item,
  busy,
  onConfirm,
  onClose,
}: {
  category: string;
  item: Item | null;
  busy: boolean;
  onConfirm: (draft: ItemInput) => void;
  onClose: () => void;
}) {
  const formId = useId();
  const def = CATEGORIES[category];
  const isEdit = !!item;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    def.fields.forEach((f) => {
      let val = isEdit ? String(get(item, f.key) ?? '') : f.default || '';
      if (isEdit && !val && f.key === 'detail.reminderCycle') val = reminderCycle(item);
      if (!val && f.key === 'currency') val = 'CNY';
      init[f.key] = val;
    });
    return init;
  });
  const [error, setError] = useState('');

  function update(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function collect(): ItemInput {
    const draft: ItemInput = { category, detail: clone((item || {}).detail || {}) };
    def.fields.forEach((f) => {
      let v: string | number | null = values[f.key] ?? '';
      if (f.type === 'number') v = v === '' || v === null ? null : Number(v);
      set(draft as never, f.key, v);
    });
    return draft;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const draft = collect();
    try {
      for (const f of def.fields) {
        const v = values[f.key] ?? '';
        const nextDateExempt = f.key === 'nextDate' && isEdit && item && item.status !== 'active' && item.status !== undefined && item.status !== '';
        if (f.required && v === '' && !nextDateExempt) {
          throw new Error('请填写「' + f.label + '」');
        }
      }
      validate({ ...(item || {}), ...draft } as ItemInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      return;
    }
    onConfirm(draft);
  }

  const primary = def.fields.filter((f) => f.required || (PRIMARY_KEYS[category] || []).includes(f.key));
  const extra = def.fields.filter((f) => !primary.includes(f));

  return (
    <Modal
      title={(isEdit ? '编辑' : '添加') + def.label}
      description="填好必要信息，更多细节可以稍后补充。"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Btn onClick={busy ? () => undefined : onClose} disabled={busy}>
            取消
          </Btn>
          <Btn variant="primary" disabled={busy} type="submit" form={formId}>
            {busy ? '保存中…' : '保存'}
          </Btn>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          {primary.map((f) => (
            <FieldRow key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => update(f.key, v)} />
          ))}
        </div>
        {extra.length > 0 && (
          <Collapsible className="group mt-6 rounded-xl border border-border">
            <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between rounded-xl px-4 py-3 text-[13px]">
              {EXTRA_LABELS[category] || '更多字段'}<Icon name="chevron" className="size-4 group-data-[state=open]:rotate-180" />
            </Button></CollapsibleTrigger>
            <CollapsibleContent><div className="grid gap-5 px-4 pb-4 pt-2 sm:grid-cols-2">
              {extra.map((f) => (
                <FieldRow key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => update(f.key, v)} />
              ))}
            </div></CollapsibleContent>
          </Collapsible>
        )}
        {category === 'broadband' && isEdit && item && !('contractDate' in (item.detail || {})) ? (
          <p className="mt-3 text-[12px] text-ink-3">
            旧记录的到期日期保留在“下次续费日期”，请核对并补充独立的合约到期日。
          </p>
        ) : null}
        {error ? <p role="alert" className="mt-4 text-xs text-destructive">{error}</p> : null}
      </form>
    </Modal>
  );
}
