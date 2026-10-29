/* RFC 5545 日历快照。日期使用本地全天事件，通知由导入文件的日历应用负责。
   行为与原 public/assets/js/calendar.js 逐行对应。 */

import { addDays, dueEntries } from './model';
import type { Item } from './types';

function escapeText(value: unknown): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function fold(line: string): string {
  let result = '';
  let length = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0)!;
    const size = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
    if (length + size > 75) {
      result += '\r\n ';
      length = 1;
    }
    result += ch;
    length += size;
  }
  return result;
}

function hash(text: string): string {
  let value = 2166136261;
  for (const ch of text) {
    value ^= ch.codePointAt(0)!;
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

export function createCalendar(items: Item[]): { text: string; count: number } {
  const entries = dueEntries(items).filter((o) => o.d >= 0);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life Hub//Reminders//ZH', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  entries.forEach((o) => {
    const x = o.x;
    const actions: Record<string, string> = { phone: '保活', broadband: '续费', parking: '缴费', asset: '复核' };
    const action = o.kind === 'contract' ? '合约到期' : actions[x.category];
    const title = action + ' · ' + x.title;
    const key = (x.detail || {}).recordKey || [x.id, x.category, x.title, x.provider].join('|');
    lines.push(
      'BEGIN:VEVENT',
      'UID:' + hash(key) + '-' + o.kind + '@life-hub.local',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + o.date.replace(/-/g, ''),
      'DTEND;VALUE=DATE:' + addDays(o.date, 1).replace(/-/g, ''),
      'SUMMARY:' + escapeText(title),
      'DESCRIPTION:' + escapeText('生活管理到期提醒。日期变更后请更新日历。' + (x.note ? '\n' + x.note : '')),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', 'DESCRIPTION:' + escapeText(title), 'END:VALARM', 'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return { text: lines.map(fold).join('\r\n') + '\r\n', count: entries.length };
}
