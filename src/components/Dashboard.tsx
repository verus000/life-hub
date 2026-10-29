'use client';

/* 主界面容器：顶栏、分类导航、总览 / 列表切换、全部弹窗与数据操作 */

import { useCallback, useRef, useState } from 'react';
import { Api, ApiError, downloadFile, toCSV } from '@/lib/api';
import { CATEGORIES, ORDER, canUndo, complete as completeItem, todayStr, undo as undoItem } from '@/lib/model';
import { backup, CATEGORIES as CATEGORY_LABELS, clone, parseImport, partition } from '@/lib/records';
import { createCalendar } from '@/lib/calendar';
import type { CompletionValues, Item, ItemInput, ValidatedFields } from '@/lib/types';
import { Btn, Modal, ConfirmDialog } from '@/components/ui';
import { toast as notify } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon, Logo } from '@/components/icons';
import { Overview } from '@/components/Overview';
import { CategoryList } from '@/components/CategoryList';
import { ItemForm } from '@/components/ItemForm';
import { CompleteModal, HistoryModal } from '@/components/ActionModals';

const PAGE_META: Record<string, { label: string; desc: string }> = {
  overview: { label: '最近的安排', desc: '保活、续费、缴费，都在这里。' },
  phone: { label: '我的手机号', desc: '查看号码与下次保活时间。' },
  broadband: { label: '我的宽带', desc: '续费时间、合约期限与宽带信息，集中管理。' },
  parking: { label: '停车缴费', desc: '记录车位信息，安排下一次缴费。' },
  asset: { label: '我的资产', desc: '按账户查看资产，定期复核余额。' },
};

type ImportPreview = {
  filename: string;
  total: number;
  created: number;
  skipped: number;
  preview: Array<{ category: string; title: string }>;
  items: ValidatedFields[];
};

export function Dashboard({ initialItems, email }: { initialItems: Item[]; email: string }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [tab, setTab] = useState('overview');
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('all');
  const [lifecycle, setLifecycle] = useState('active');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [offline, setOffline] = useState(false);

  const [formState, setFormState] = useState<{ category: string; item: Item | null } | null>(null);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<Item | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Item | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ type: 'remove'; item: Item } | { type: 'wipe' } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const showToast = useCallback((msg: string) => { notify(msg); }, []);

  const refresh = useCallback(async () => {
    try {
      setItems(await Api.list());
      setOffline(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return;
      setOffline(true);
      throw e;
    }
  }, []);

  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setModalError('');
      try {
        await task();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        const msg = e instanceof Error ? e.message : '操作失败，请重试';
        setModalError(msg);
        showToast(msg);
      } finally {
        setBusy(false);
      }
    },
    [busy, showToast],
  );

  /* ---------- 添加 / 编辑 ---------- */

  function openAdd(category?: string) {
    setChooseOpen(false);
    if (!category && tab === 'overview') {
      setChooseOpen(true);
      return;
    }
    setFormState({ category: category || tab, item: null });
  }

  function openEdit(id: number) {
    const x = items.find((i) => String(i.id) === String(id));
    if (x) setFormState({ category: x.category, item: x });
  }

  function saveItem(draft: ItemInput) {
    const { category, item } = formState || {};
    if (!category) return;
    void run(async () => {
      const merged = { ...(item || {}), ...draft } as ItemInput;
      if (item && draft.nextDate !== undefined && draft.nextDate !== item.nextDate && draft.detail) {
        const detail = { ...draft.detail };
        delete detail.reminderAnchor;
        draft.detail = detail;
      }
      if (item) {
        await Api.update(item.id, draft, item.updatedAt);
        showToast('已保存修改');
      } else {
        await Api.add(merged);
        showToast('已添加「' + (draft.title || '') + '」');
      }
      setFormState(null);
      await refresh();
    });
  }

  /* ---------- 处理 / 撤销 / 状态 ---------- */

  function submitComplete(values: CompletionValues) {
    const x = completeTarget;
    if (!x) return;
    void run(async () => {
      const patch = completeItem(x, values);
      await Api.update(x.id, patch as ItemInput, x.updatedAt);
      setCompleteTarget(null);
      await refresh();
      showToast('已记录，可在处理记录中查看或撤销');
    });
  }

  function undoLast() {
    const x = historyTarget;
    if (!x) return;
    void run(async () => {
      await Api.update(x.id, undoItem(x) as ItemInput, x.updatedAt);
      setHistoryTarget(null);
      await refresh();
      showToast('已撤销最近一次处理');
    });
  }

  function changeStatus(id: number, status: string) {
    void run(async () => {
      const x = items.find((i) => i.id === id);
      if (!x) return;
      const detail = clone(x.detail || {});
      detail.history = (detail.history || []).concat([
        { type: 'status', action: status, at: new Date().toISOString() },
      ]);
      await Api.update(id, { status, detail }, x.updatedAt);
      await refresh();
      showToast('状态已更新，可在条目状态筛选中查看');
    });
  }

  function removeItem(id: number) {
    const item = items.find((entry) => entry.id === id);
    if (item) setConfirmTarget({ type: 'remove', item });
  }

  function wipe() {
    setConfirmTarget({ type: 'wipe' });
  }

  function confirmDelete() {
    const target = confirmTarget;
    if (!target) return;
    void run(async () => {
      if (target.type === 'remove') await Api.remove(target.item.id);
      else await Api.clear();
      setConfirmTarget(null);
      await refresh();
      showToast(target.type === 'remove' ? '已删除' : '已清空');
    });
  }

  /* ---------- 导入导出 ---------- */

  function exportCSV() {
    const cat = tab === 'overview' ? null : tab;
    const rows = cat ? items.filter((x) => x.category === cat) : items;
    if (!rows.length) {
      showToast('暂无数据可导出');
      return;
    }
    downloadFile(
      '\uFEFF' + toCSV(rows),
      '生活管理_' + (cat ? CATEGORIES[cat].label : '全部') + '_' + todayStr() + '.csv',
      'text/csv;charset=utf-8',
    );
    showToast('已导出 ' + rows.length + ' 条，包含扩展信息和处理记录');
  }

  function exportBackup() {
    downloadFile(backup(items), '生活管理_完整备份_' + todayStr() + '.json', 'application/json;charset=utf-8');
    showToast('已备份全部 ' + items.length + ' 条记录');
  }

  function pickImportFile() {
    fileRef.current?.click();
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void file.text().then((text) => {
      try {
        const parsed = parseImport(text, tab === 'overview' ? 'phone' : tab);
        if (parsed.errors.length) {
          showToast(
            parsed.errors.slice(0, 3).join('；') + (parsed.errors.length > 3 ? '；共 ' + parsed.errors.length + ' 处错误' : ''),
          );
          return;
        }
        if (!parsed.items.length) {
          showToast('没有可导入的条目');
          return;
        }
        const batch = partition(parsed.items as ItemInput[], items);
        setImportPreview({
          filename: file.name,
          total: parsed.total,
          created: batch.items.length,
          skipped: batch.skipped,
          preview: batch.items.slice(0, 8).map((x) => ({
            category: String(x.category || ''),
            title: String(x.title || ''),
          })),
          items: parsed.items,
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : '导入失败');
      }
    });
  }

  function commitImport() {
    const preview = importPreview;
    if (!preview) return;
    void run(async () => {
      const result = await Api.importItems(preview.items as ItemInput[]);
      setImportPreview(null);
      await refresh();
      showToast('已导入 ' + result.created + ' 条，跳过重复 ' + result.skipped + ' 条');
    });
  }

  function downloadCalendar() {
    const result = createCalendar(items);
    if (!result.count) {
      showToast('没有今天或未来的在用提醒');
      return;
    }
    downloadFile(result.text, '生活管理_提醒_' + todayStr() + '.ics', 'text/calendar;charset=utf-8');
    setCalendarOpen(false);
    showToast('已导出 ' + result.count + ' 项，请导入日历并检查通知设置');
  }

  async function logout() {
    try {
      await Api.logout();
    } finally {
      window.location.href = '/login';
    }
  }

  /* ---------- 渲染 ---------- */

  function switchTab(key: string) {
    setTab(key);
    setKeyword('');
    setFilter('all');
    setLifecycle('active');
  }

  const meta = PAGE_META[tab] || PAGE_META.overview;
  const day = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const counts: Record<string, number> = {};
  items.forEach((x) => {
    counts[x.category] = (counts[x.category] || 0) + 1;
  });

  const tabs = [{ key: 'overview', label: '最近', count: 0 }].concat(
    ORDER.map((k) => ({ key: k, label: k === 'asset' ? '资产' : CATEGORIES[k].label, count: counts[k] || 0 })),
  );

  return (
    <Tabs value={tab} onValueChange={switchTab} className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1088px] items-center gap-2 px-4 py-4 sm:gap-3 sm:px-8 sm:py-5">
          <div className="mr-auto flex items-center gap-2.5 text-brand">
            <Logo className="h-9 w-9 -rotate-6" />
            <div>
              <span className="block text-base font-extrabold tracking-wide text-ink sm:text-lg">生活管理</span>
              <span className="block text-[10px] font-medium tracking-[0.18em] text-ink-3">LIFE HUB</span>
            </div>
          </div>
          <Btn variant="primary" onClick={() => openAdd()}>
            <Icon name="plus" className="h-4 w-4" />
            <span>添加<span className="hidden sm:inline">安排</span></span>
          </Btn>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label="更多操作" className="px-3"><Icon name="more" /><span className="hidden sm:inline">更多</span></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="break-all">{email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCalendarOpen(true)}><Icon name="calendar" />日历提醒</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportBackup}><Icon name="download" />备份全部记录</DropdownMenuItem>
              <DropdownMenuItem onSelect={pickImportFile}><Icon name="upload" />导入数据</DropdownMenuItem>
              <DropdownMenuItem onSelect={exportCSV}><Icon name="layers" />导出表格</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}><Icon name="logout" />退出登录</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={wipe}><Icon name="trash" />清空全部数据</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            hidden
            onChange={onImportFile}
          />
        </div>
      </header>

      <div className="bg-surface border-b border-line/70">
        <nav className="mx-auto w-full max-w-[1088px] px-4 pb-4 sm:px-8" aria-label="生活分类">
          <TabsList aria-label="生活分类" className="grid w-full max-w-full grid-cols-5 sm:inline-flex sm:w-auto">
            {tabs.map((entry) => <TabsTrigger key={entry.key} value={entry.key} className="min-w-0 px-1.5 sm:px-3">
              <Icon name={entry.key === 'overview' ? 'sun' : entry.key} className="hidden size-4 sm:block" />
              {entry.label}
              {entry.count > 0 && <span className="hidden text-[11px] opacity-80 sm:inline">{entry.count}</span>}
            </TabsTrigger>)}
          </TabsList>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-[1024px] mx-auto px-4 py-6 sm:px-8 sm:py-8">
        {tabs.map(({ key }) => <TabsContent key={key} value={key} className="space-y-5">
          {key === tab && <>
            {tab !== 'overview' ? <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="m-0 text-[22px] font-extrabold text-ink">{meta.label}</h1>
                <p className="m-0 mt-1 text-sm text-ink-3">{meta.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-ink-3 shrink-0">
                <Icon name="calendar" className="w-4 h-4" />
                <span>{day}</span>
              </div>
            </div> : null}

            {tab === 'overview' ? (
              <Overview
                items={items}
                dateLabel={day}
                onMarkDone={(id) => {
                  const x = items.find((i) => i.id === id);
                  if (x) setCompleteTarget(x);
                }}
                onOpenEdit={openEdit}
                onOpenAdd={openAdd}
                onGotoTab={switchTab}
              />
            ) : (
              <CategoryList
                items={items}
                category={tab}
                keyword={keyword}
                filter={filter}
                lifecycle={lifecycle}
                onKeyword={setKeyword}
                onFilter={setFilter}
                onLifecycle={setLifecycle}
                onMarkDone={(id) => {
                  const x = items.find((i) => i.id === id);
                  if (x) setCompleteTarget(x);
                }}
                onOpenEdit={openEdit}
                onOpenAdd={openAdd}
                onHistory={(id) => {
                  const x = items.find((i) => i.id === id);
                  if (x) setHistoryTarget(x);
                }}
                onChangeStatus={changeStatus}
                onRemove={removeItem}
              />
            )}
          </>}
        </TabsContent>)}
      </main>

      <footer className="mx-auto flex w-full max-w-[1024px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pb-6 pt-2 text-xs text-ink-3 sm:px-8">
        <div>
          <p className="m-0 font-medium">小事有着落，生活更轻松。</p>
          <p className="m-0 mt-1">{offline ? '暂时无法连接，展示最近加载的记录' : '记录已同步'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setCalendarOpen(true)}>
          <Icon name="calendar" className="h-4 w-4" />导出日历提醒
        </Button>
      </footer>

      {chooseOpen ? (
        <Modal title="选择要添加的分类" onClose={() => setChooseOpen(false)}>
          <div className="grid gap-2">
            {ORDER.map((k) => (
              <Button variant="outline"
                key={k}
                className="h-auto w-full justify-start gap-3 px-4 py-3"
                onClick={() => openAdd(k)}
              >
                <span className="category-icon" data-category={k}>
                  <Icon name={k} />
                </span>
                <span className="flex-1 text-left">{CATEGORY_LABELS[k]}</span>
                <Icon name="arrow" className="w-4 h-4 text-ink-3" />
              </Button>
            ))}
          </div>
        </Modal>
      ) : null}

      {formState ? (
        <ItemForm
          category={formState.category}
          item={formState.item}
          busy={busy}
          onConfirm={saveItem}
          onClose={() => setFormState(null)}
        />
      ) : null}

      {completeTarget ? (
        <CompleteModal
          item={completeTarget}
          busy={busy}
          error={modalError}
          onConfirm={submitComplete}
          onClose={() => setCompleteTarget(null)}
        />
      ) : null}

      {historyTarget ? (
        <HistoryModal
          item={historyTarget}
          busy={busy}
          canUndo={canUndo(historyTarget)}
          onUndo={undoLast}
          onClose={() => setHistoryTarget(null)}
        />
      ) : null}

      {importPreview ? (
        <Modal
          title="确认导入"
          onClose={busy ? () => undefined : () => setImportPreview(null)}
          footer={
            <>
              <Btn disabled={busy} onClick={busy ? () => undefined : () => setImportPreview(null)}>
                取消
              </Btn>
              <Btn variant="primary" disabled={busy} onClick={commitImport}>
                {busy ? '导入中…' : '合并导入'}
              </Btn>
            </>
          }
        >
          <p className="m-0 text-[13px] text-ink">{importPreview.filename}</p>
          <p className="m-0 mt-2 text-[13px] text-ink-2">
            共 {importPreview.total} 条：预计新增 <b className="text-ink">{importPreview.created}</b> 条，跳过重复{' '}
            <b className="text-ink">{importPreview.skipped}</b> 条。
          </p>
          <p className="m-0 mt-1.5 text-[12px] text-ink-3">
            合并后保留现有记录。完整备份中的分类、状态、扩展信息和处理记录会一起导入。
          </p>
          <div className="mt-3 grid gap-1 rounded-xl bg-surface-soft border border-line px-4 py-3 text-[12px] text-ink-2">
            {importPreview.preview.map((p, i) => (
              <div key={i}>
                {CATEGORY_LABELS[p.category] || p.category} · {p.title}
              </div>
            ))}
            {importPreview.created > 8 ? <p className="m-0">另有 {importPreview.created - 8} 条</p> : null}
          </div>
        </Modal>
      ) : null}

      {calendarOpen ? (
        <Modal title="导出日历提醒" onClose={() => setCalendarOpen(false)}>
          <p className="m-0 text-[13px] text-ink-2">
            可导出今天及未来的在用提醒，包括保活、缴费、资产复核和宽带合约到期。
          </p>
          <p className="m-0 mt-2 text-[13px] text-ink-2">
            下载后导入手机或电脑的日历，检查日历中的提醒设置。文件包含提前一天的提醒，是否通知由日历应用及系统权限决定。
          </p>
          <p className="m-0 mt-1.5 text-[12px] text-ink-3">
            这是当前日期的快照。修改日期、暂停或归档后，请在日历中移除旧事项并重新导入。过期事项仍可在本应用中处理。
          </p>
          <Btn variant="primary" className="mt-4" onClick={downloadCalendar}>
            下载提醒日历
          </Btn>
        </Modal>
      ) : null}

      {confirmTarget && <ConfirmDialog
        title={confirmTarget.type === 'wipe' ? '清空全部记录？' : '删除这条记录？'}
        description={confirmTarget.type === 'wipe' ? '所有分类的记录都将删除，且无法撤销。建议先下载完整备份。' : '“' + confirmTarget.item.title + '”将被永久删除，此操作无法撤销。'}
        busy={busy}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmDelete}
      />}
    </Tabs>
  );
}
