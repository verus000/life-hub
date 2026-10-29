/* 应用层条目类型：数据库行（snake_case）经服务层映射后的形态 */

export type Snapshot = {
  nextDate: string;
  status: string;
  amount: number | null;
  reminderAnchor: number | null;
  lastCompletedAt: string;
}

export type HistoryEntry = {
  type: string;
  action: string;
  date?: string;
  at: string;
  amount?: number | null;
  currency?: string;
  note?: string;
  before?: Snapshot;
  after?: Snapshot;
  undoneAt?: string;
}

export type ItemDetail = {
  recordKey?: string;
  country?: string;
  strategy?: string;
  reminderCycle?: string;
  reminderAnchor?: number;
  lastCompletedAt?: string;
  speed?: string;
  address?: string;
  accountNo?: string;
  autoRenew?: string;
  contractDate?: string;
  slot?: string;
  cardType?: string;
  channel?: string;
  assetType?: string;
  history?: HistoryEntry[];
  [key: string]: unknown;
}

export type Item = {
  id: number;
  userId: number | null;
  category: string;
  title: string;
  provider: string;
  amount: number | null;
  currency: string;
  cycle: string;
  startDate: string;
  nextDate: string;
  status: string;
  detail: ItemDetail;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/* validate 的输入：宽松的部分字段 */
export type ItemInput = {
  title?: string | null;
  provider?: string | null;
  note?: string | null;
  startDate?: string | null;
  nextDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  category?: string | null;
  cycle?: string | null;
  status?: string | null;
  currency?: string | null;
  amount?: number | string | null;
  detail?: ItemDetail | null;
  expectedUpdatedAt?: string;
  [key: string]: unknown;
}

/* validate 的输出：只包含通过校验的字段 */
export type ValidatedFields = {
  title?: string;
  provider?: string;
  note?: string;
  startDate?: string;
  nextDate?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  cycle?: string;
  status?: string;
  currency?: string;
  amount?: number | null;
  detail?: ItemDetail;
}

export type DueEntry = {
  x: Item;
  date: string;
  kind: 'task' | 'contract';
  d: number;
}

export type CompletionValues = {
  date?: string;
  amount?: string | number | null;
  currency?: string;
  nextDate?: string;
  note?: string;
}
