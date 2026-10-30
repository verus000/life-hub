'use client';

/* 记录处理弹窗：保活 / 续费 / 缴费 / 复核 */

import { useId, useState } from 'react';
import { categoryAction, dateLabel, moneyLabel, reminderCycle, shiftNext, statusOf, todayStr } from '@/lib/model';
import { CYCLES } from '@/lib/records';
import type { CompletionValues, Item } from '@/lib/types';
import { Btn, Modal, STATUS_TEXT } from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { AmountField } from '@/components/ui/amount-field';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';


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
  const fieldId = useId();
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
      title={'记录' + categoryAction(item.category, item.detail)}
      description={item.title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Btn disabled={busy} onClick={busy ? () => undefined : onClose}>
            取消
          </Btn>
          <Btn variant="primary" disabled={busy || !values.date} type="submit" form={fieldId + '-form'}>
            {busy ? '记录中…' : '确认并记录'}
          </Btn>
        </>
      }
    >
      <form id={fieldId + '-form'} onSubmit={submit} noValidate>
        {/* 顶部摘要：正在处理哪一条、原定哪天到期 */}
        <div className="mb-6 rounded-xl bg-surface-soft px-4 py-4">
          <div className="min-w-0">
            <div className="mt-0.5 text-[13px] text-ink-3">
              {item.nextDate ? '原定 ' + dateLabel(item.nextDate) : '未设日期'}{CYCLES[reminderCycle(item)] ? ' · ' + CYCLES[reminderCycle(item)] : ''}
            </div>
            <p className={'m-0 mt-2 text-sm ' + STATUS_TEXT[statusOf(item).key]}>{statusOf(item).label}</p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className={once ? '' : 'grid gap-4 sm:grid-cols-2'}>
            <div className="min-w-0">
              <Label htmlFor={fieldId + '-date'} className="mb-2 block text-ink-2">实际处理日期</Label>
              <DatePicker id={fieldId + '-date'} label="实际处理日期" value={values.date} onChange={(value) => update('date', value)} />
            </div>
            {!once ? (
              <div className="min-w-0">
              <Label htmlFor={fieldId + '-next'} className="mb-2 block text-ink-2">{item.category === 'phone' ? '下次保活日期' : '下次日期'}</Label>
                <DatePicker id={fieldId + '-next'} label={item.category === 'phone' ? '下次保活日期' : '下次日期'} value={values.nextDate} onChange={(value) => update('nextDate', value)} />
                <p className="m-0 mt-1.5 text-xs text-ink-3">留空则停止提醒</p>
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <Label htmlFor={fieldId + '-amount'} className="mb-2 block text-ink-2">
              {item.category === 'asset' ? '复核后余额' : '本次费用'}
              {item.category !== 'asset' ? <span className="ml-1.5 font-normal text-ink-3">可留空</span> : null}
            </Label>
            <AmountField id={fieldId + '-amount'} label={item.category === 'asset' ? '复核后余额' : '本次费用'}
              amount={values.amount} currency={values.currency}
              onAmount={(value) => update('amount', value)} onCurrency={(value) => update('currency', value)} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={fieldId + '-note'} className="mb-2 block text-ink-2">处理备注</Label>
            <Textarea id={fieldId + '-note'} value={values.note} rows={2} onChange={(e) => update('note', e.target.value)} />
          </div>
        </div>
        <p className="m-0 mt-4 text-xs leading-relaxed text-ink-3">
          {once
            ? '一次性事项完成后移入“已完成”，停止提醒。'
            : '请核对下次日期；月底会顺延到目标月的最后一个有效日期。'}
          {item.category === 'broadband' ? '合约到期日保持独立，请续约后在编辑中更新。' : ''}
        </p>
        {error ? <p role="alert" className="m-0 mt-3 text-xs text-destructive">{error}</p> : null}
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
            <Card role="article" key={i} className="rounded-xl bg-muted/40 px-4 py-3 shadow-none">
              <strong className="text-[13px] text-ink">
                {e.action || '处理'}
                {e.undoneAt ? '（已撤销）' : ''}
              </strong>
              <div className="mt-1 text-[12px] text-ink-2">
                {dateLabel(e.date || String(e.at || '').slice(0, 10))}
                {e.amount !== null && e.amount !== undefined
                  ? ' · ' + moneyLabel(Number(e.amount), currencyOf(e))
                  : ''}
              </div>
              {e.type === 'complete' ? (
                <div className="mt-0.5 text-[12px] text-ink-3">
                  下次日期：{(e.before || {}).nextDate || '未设置'} → {(e.after || {}).nextDate || '停止提醒'}
                </div>
              ) : null}
              {e.note ? <p className="m-0 mt-1 text-[12px] text-ink-2">{e.note}</p> : null}
            </Card>
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
