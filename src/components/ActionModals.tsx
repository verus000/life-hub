'use client';

/* 记录处理弹窗：保活 / 续费 / 缴费 / 复核 */

import { useState } from 'react';
import { money, reminderCycle, shiftNext, todayStr } from '@/lib/model';
import { CYCLES } from '@/lib/records';
import type { CompletionValues, Item } from '@/lib/types';
import { Btn, Modal } from '@/components/ui';

const inputCls =
  'w-full min-h-[38px] px-3 rounded-[10px] border border-line-strong bg-white text-[13px] text-ink focus:outline-2 focus:outline-brand focus:border-brand';

export function CompleteModal({
  item,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  item: Item;
  busy: boolean;
  error: string;
  onConfirm: (values: CompletionValues) => void;
  onClose: () => void;
}) {
  const once = reminderCycle(item) === 'once';
  const [values, setValues] = useState<Record<string, string>>({
    date: todayStr(),
    amount: item.category === 'phone' ? '' : item.amount === null || item.amount === undefined ? '' : String(item.amount),
    currency: item.currency || 'CNY',
    nextDate: once ? '' : shiftNext(item),
    note: '',
  });

  function update(k: string, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.date) return;
    onConfirm({
      date: values.date,
      amount: values.amount === '' ? null : values.amount,
      currency: values.currency,
      nextDate: values.nextDate,
      note: values.note,
    });
  }

  return (
    <Modal
      title={'记录' + (item.category === 'phone' ? '保活' : item.category === 'broadband' ? '续费' : item.category === 'parking' ? '缴费' : '复核')}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Btn disabled={busy} onClick={busy ? () => undefined : onClose}>
            取消
          </Btn>
          <Btn variant="primary" disabled={busy || !values.date} onClick={() => submit({ preventDefault: () => undefined } as React.FormEvent)}>
            {busy ? '记录中…' : '确认并记录'}
          </Btn>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <p className="m-0 mb-4 text-[13px] text-ink-2">
          {item.title} · {CYCLES[reminderCycle(item)] || ''}
        </p>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div>
            <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">实际处理日期</label>
            <input type="date" value={values.date} className={inputCls} onChange={(e) => update('date', e.target.value)} />
          </div>
          <div>
            <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">
              {item.category === 'asset' ? '复核后余额' : '本次实际费用（可留空）'}
            </label>
            <input
              type="number"
              step="0.01"
              value={values.amount}
              className={inputCls}
              onChange={(e) => update('amount', e.target.value)}
            />
          </div>
          <div>
            <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">币种</label>
            <input type="text" value={values.currency} className={inputCls} onChange={(e) => update('currency', e.target.value)} />
          </div>
          {!once ? (
            <div>
              <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">下次日期（留空停止提醒）</label>
              <input type="date" value={values.nextDate} className={inputCls} onChange={(e) => update('nextDate', e.target.value)} />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="grid gap-1.5 mb-1 text-[12px] text-ink-2">处理备注</label>
            <textarea value={values.note} rows={3} className={inputCls + ' py-2 min-h-[70px]'} onChange={(e) => update('note', e.target.value)} />
          </div>
        </div>
        <p className="m-0 mt-3 text-[12px] text-ink-3">
          {once
            ? '一次性事项完成后移入“已完成”，停止提醒。'
            : '请核对下次日期；月底会顺延到目标月的最后一个有效日期。'}
          {item.category === 'broadband' ? '合约到期日保持独立，请续约后在编辑中更新。' : ''}
        </p>
        {error ? <p className="m-0 mt-2 text-[12px] text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
}

/* 处理记录弹窗：历史列表 + 撤销最近一次 */
export function HistoryModal({
  item,
  busy,
  canUndo,
  onUndo,
  onClose,
}: {
  item: Item;
  busy: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  const entries = ((item.detail || {}).history || []).slice().reverse();
  const currencyOf = (e: { currency?: string }) => e.currency || item.currency || 'CNY';

  return (
    <Modal title="处理记录" onClose={busy ? () => undefined : onClose}>
      <p className="m-0 mb-3 text-[13px] text-ink-2">{item.title}</p>
      {canUndo ? (
        <Btn className="mb-3" disabled={busy} onClick={busy ? () => undefined : onUndo}>
          撤销最近一次处理
        </Btn>
      ) : null}
      {entries.length ? (
        <div className="grid gap-2.5">
          {entries.map((e, i) => (
            <article key={i} className="rounded-xl bg-surface-soft border border-line px-4 py-3">
              <strong className="text-[13px] text-ink">
                {e.action || '处理'}
                {e.undoneAt ? '（已撤销）' : ''}
              </strong>
              <div className="mt-1 text-[12px] text-ink-2">
                {e.date || String(e.at || '').slice(0, 10)}
                {e.amount !== null && e.amount !== undefined
                  ? ' · ' + currencyOf(e) + ' ' + money(e.amount, currencyOf(e))
                  : ''}
              </div>
              {e.type === 'complete' ? (
                <div className="mt-0.5 text-[12px] text-ink-3">
                  下次日期：{(e.before || {}).nextDate || '未设置'} → {(e.after || {}).nextDate || '停止提醒'}
                </div>
              ) : null}
              {e.note ? <p className="m-0 mt-1 text-[12px] text-ink-2">{e.note}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-[13px] text-ink-3">还没有处理记录</div>
      )}
      <p className="m-0 mt-3 text-[12px] text-ink-3">
        可撤销最新一次处理。后续日期、金额或状态已有变更时，请通过编辑调整。
      </p>
    </Modal>
  );
}
