/* 输入侧脱敏：只返回尾号，原值不保留在任何附加字段。 */
export function maskIdentifier(value: string): string {
  const compact = value.trim().replace(/[\s*•·-]/g, '');
  if (!compact) return '';
  return '••••' + Array.from(compact).slice(-4).join('');
}
