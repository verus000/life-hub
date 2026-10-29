'use client';

/* 添加/编辑条目表单：由 Model.CATEGORIES 的字段定义驱动渲染 */

import { useState } from 'react';
import { CATEGORIES, addDays, get, reminderCycle, searchCountries, set, todayStr } from '@/lib/model';
import type { FieldDef } from '@/lib/model';
import { clone, validate } from '@/lib/records';
import type { Item, ItemInput } from '@/lib/types';
import { Btn, Modal } from '@/components/ui';

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

const inputCls =
  'w-full min-h-[38px] px-3 rounded-[10px] border border-line-strong bg-white text-[13px] text-ink focus:outline-2 focus:outline-brand focus:border-brand';

function CountrySuggest({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const hits = searchCountries(value).slice(0, 40);
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        autoComplete="off"
        placeholder="输入中文或英文过滤"
        className={inputCls}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && hits.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-[10px] bg-surface border border-line shadow-lg">
          {hits.map((c) => (
            <button
              type="button"
              key={c[0]}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink hover:bg-surface-soft"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c[0]);
                setOpen(false);
              }}
            >
              <span>{c[2]}</span>
              <span>{c[0]}</span>
              <span className="text-[12px] text-ink-3">{c[1]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  const chip = 'px-2.5 h-7 rounded-full border border-line text-[12px] text-ink-2 bg-surface hover:bg-brand-soft hover:text-brand';
  let control: React.ReactNode;

  if (f.type === 'select') {
    const known = (f.options || []).some((o) => String(o[0]) === String(value));
    control = (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">请选择</option>
        {!known && value ? <option value={value}>{value}</option> : null}
        {(f.options || []).map((o) => (
          <option key={o[0]} value={o[0]}>
            {o[1]}
          </option>
        ))}
      </select>
    );
  } else if (f.type === 'textarea') {
    control = (
      <textarea value={value} placeholder={f.placeholder || ''} rows={3} onChange={(e) => onChange(e.target.value)} className={inputCls + ' py-2 min-h-[70px]'} />
    );
  } else if (f.type === 'country') {
    control = <CountrySuggest value={value} onChange={onChange} />;
  } else if (f.type === 'suggest') {
    control = (
      <>
        <input type="text" value={value} placeholder={f.placeholder || ''} className={inputCls} onChange={(e) => onChange(e.target.value)} />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {(f.presets || []).map((p) => (
            <button key={p} type="button" className={chip} onClick={() => onChange(p)}>
              {p}
            </button>
          ))}
        </div>
      </>
    );
  } else if (f.type === 'date') {
    control = (
      <>
        <input type="date" value={value} className={inputCls} onChange={(e) => onChange(e.target.value)} />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              className={chip}
              onClick={() => onChange(addDays(value || todayStr(), n))}
            >
              +{n}天
            </button>
          ))}
          <button type="button" className={chip} onClick={() => onChange(todayStr())}>
            今天
          </button>
        </div>
      </>
    );
  } else if (f.type === 'number') {
    control = (
      <input
        type="number"
        step="0.01"
        value={value}
        placeholder={f.placeholder || ''}
        className={inputCls}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else {
    control = (
      <input type="text" value={value} placeholder={f.placeholder || ''} className={inputCls} onChange={(e) => onChange(e.target.value)} />
    );
  }

  return (
    <div className={f.full ? 'sm:col-span-2' : ''}>
      <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">
        {f.label}
        {f.required ? <span className="text-danger">*</span> : null}
      </label>
      {control}
    </div>
  );
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
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Btn onClick={busy ? () => undefined : onClose} disabled={busy}>
            取消
          </Btn>
          <Btn variant="primary" disabled={busy} onClick={submit as never}>
            {busy ? '保存中…' : '保存'}
          </Btn>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <div className="grid sm:grid-cols-2 gap-3.5">
          {primary.map((f) => (
            <FieldRow key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => update(f.key, v)} />
          ))}
        </div>
        {extra.length > 0 && (
          <details className="mt-4 rounded-xl border border-line">
            <summary className="cursor-pointer select-none px-4 py-3 text-[13px] text-ink-2 hover:text-ink">
              {EXTRA_LABELS[category] || '更多字段'}
            </summary>
            <div className="grid sm:grid-cols-2 gap-3.5 px-4 pb-4">
              {extra.map((f) => (
                <FieldRow key={f.key} f={f} value={values[f.key] ?? ''} onChange={(v) => update(f.key, v)} />
              ))}
            </div>
          </details>
        )}
        {category === 'broadband' && isEdit && item && !('contractDate' in (item.detail || {})) ? (
          <p className="mt-3 text-[12px] text-ink-3">
            旧记录的到期日期保留在“下次续费日期”，请核对并补充独立的合约到期日。
          </p>
        ) : null}
        {error ? <p className="mt-3 text-[12px] text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
}
