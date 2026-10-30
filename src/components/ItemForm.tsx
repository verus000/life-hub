'use client';

/* 添加/编辑条目表单：字段定义来自 Model.CATEGORIES，版式由下方 LAYOUT 决定 */

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
import { AmountField } from '@/components/ui/amount-field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

/* 表单版式：每类分成两三个小节，每行最多两个字段（宽屏并排、手机堆叠）。
   MONEY 把金额和币种合成一个输入组；未列出的字段自动落到“更多信息”，新增字段不会丢。 */
const MONEY = 'amount+currency';
type Section = { title: string; rows: string[][] };
const LAYOUT: Record<string, { sections: Section[]; more: string[][] }> = {
  phone: {
    sections: [
      { title: '号码', rows: [['title'], ['provider', 'detail.country']] },
      { title: '保活提醒', rows: [['nextDate', 'detail.reminderCycle'], ['detail.strategy']] },
    ],
    more: [[MONEY, 'cycle'], ['startDate'], ['note']],
  },
  broadband: {
    sections: [
      { title: '宽带', rows: [['title'], ['provider', 'detail.speed']] },
      { title: '续费', rows: [['nextDate', 'cycle'], [MONEY], ['detail.contractDate', 'detail.autoRenew']] },
    ],
    more: [['detail.address'], ['detail.accountNo', 'startDate'], ['note']],
  },
  parking: {
    sections: [
      { title: '车位', rows: [['title'], ['provider', 'detail.slot']] },
      { title: '缴费', rows: [['nextDate', 'cycle'], [MONEY, 'detail.cardType']] },
    ],
    more: [['detail.channel', 'startDate'], ['note']],
  },
  asset: {
    sections: [
      { title: '账户', rows: [['title'], ['detail.assetType', 'provider']] },
      { title: '余额', rows: [[MONEY]] },
    ],
    more: [['nextDate', 'detail.reminderCycle'], ['note']],
  },
};

function FieldLabel({ htmlFor, f }: { htmlFor: string; f: FieldDef }) {
  return <Label htmlFor={htmlFor} className="mb-2 block text-ink-2">
    {f.label}{f.required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
  </Label>;
}

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
      {/* 常用选项单行横向滚动，选中项高亮，不再把表单撑成好几行 */}
      {f.type === 'suggest' && <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {(f.presets || []).map((preset) => <Button key={preset} size="xs" variant="outline"
          aria-pressed={value === preset}
          className={'shrink-0 rounded-full font-normal shadow-none ' + (value === preset ? 'border-brand bg-brand-soft text-mint-ink' : 'text-ink-2')}
          onClick={() => onChange(preset)}>{preset}</Button>)}
      </div>}
    </>;
  }
  return <div className="min-w-0">
    <FieldLabel htmlFor={fieldId} f={f} />
    {control}
  </div>;
}

export function ItemForm({
  category,
  item,
  busy,
  onConfirm,
  onClose,
  onRemove,
}: {
  category: string;
  item: Item | null;
  busy: boolean;
  onConfirm: (draft: ItemInput) => void;
  onClose: () => void;
  onRemove?: (id: number) => void;
}) {
  const formId = useId();
  const moneyId = useId();
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

  const layout = LAYOUT[category] || { sections: [{ title: def.label, rows: [] }], more: [] };
  const placed = new Set(layout.sections.flatMap((s) => s.rows).concat(layout.more).flat()
    .flatMap((k) => (k === MONEY ? ['amount', 'currency'] : [k])));
  const more = layout.more.concat(def.fields.filter((f) => !placed.has(f.key)).map((f) => [f.key]));
  const fieldOf = (key: string) => def.fields.find((f) => f.key === key);
  const moreLabels = more.flat().map((k) => fieldOf(k === MONEY ? 'amount' : k)?.label).filter(Boolean).join('、');

  function cell(key: string) {
    if (key === MONEY) {
      const f = fieldOf('amount');
      return f ? <div key={key} className="min-w-0">
        <FieldLabel htmlFor={moneyId} f={f} />
        <AmountField id={moneyId} label={f.label} amount={values.amount ?? ''} currency={values.currency ?? 'CNY'}
          onAmount={(v) => update('amount', v)} onCurrency={(v) => update('currency', v)} />
      </div> : null;
    }
    const f = fieldOf(key);
    return f ? <FieldRow key={key} f={f} value={values[key] ?? ''} onChange={(v) => update(key, v)} /> : null;
  }

  const renderRows = (rows: string[][]) => rows.map((row) => (
    <div key={row.join()} className={row.length > 1 ? 'grid gap-4 sm:grid-cols-2' : ''}>{row.map(cell)}</div>
  ));

  return (
    <Modal
      title={(isEdit ? '编辑' : '添加') + def.label}
      description={category === 'phone' ? '先记下号码与保活日期，其余按需补充。' : '填好必要信息，更多细节可以稍后补充。'}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          {/* 编辑时左下角提供删除，点击后走统一的二次确认弹窗 */}
          {item && onRemove ? (
            <Btn variant="quiet" className="mr-auto text-danger hover:bg-danger-soft hover:text-danger" disabled={busy} onClick={() => onRemove(item.id)}>
              <Icon name="trash" />删除
            </Btn>
          ) : null}
          <Btn onClick={busy ? () => undefined : onClose} disabled={busy}>
            取消
          </Btn>
          <Btn variant="primary" disabled={busy} type="submit" form={formId}>
            {busy ? '保存中…' : isEdit ? '保存修改' : '保存' + def.label}
          </Btn>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <div className="grid gap-7">
          {layout.sections.map((s) => (
            <fieldset key={s.title} className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-4 flex w-full items-center gap-3 p-0 text-base font-semibold text-ink">
                {s.title}<span className="h-px flex-1 bg-line" aria-hidden="true" />
              </legend>
              <div className="grid gap-4">{renderRows(s.rows)}</div>
            </fieldset>
          ))}
        </div>
        {category === 'phone' && <p className="m-0 mt-4 text-xs text-ink-2">保活周期与缴费周期可分别设置。</p>}
        {more.length > 0 && (
          <Collapsible className="group mt-6">
            <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between gap-3 rounded-none border-y border-line px-0 py-4 text-sm text-ink hover:bg-brand-soft">
              <span className="flex min-w-0 flex-col items-start gap-1 text-left">更多信息<span className="max-w-full truncate text-xs font-normal text-ink-3">{moreLabels}</span></span>
              <Icon name="chevron" className="size-4 group-data-[state=open]:rotate-180" />
            </Button></CollapsibleTrigger>
            <CollapsibleContent><div className="grid gap-4 pt-4">{renderRows(more)}</div></CollapsibleContent>
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
