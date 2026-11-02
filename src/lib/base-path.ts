/* 构建时固定的部署前缀；仅手写 URL 使用，Next 的 Link / redirect 会自动处理。 */
export function normalizeBasePath(value: string): string {
  const path = value.trim().replace(/\/+$/, '');
  if (path && !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)) {
    throw new Error('NEXT_PUBLIC_BASE_PATH 必须为空或 /life-hub 形式的路径，不含域名、查询参数或 ..');
  }
  return path;
}

export function getBasePath(): string {
  return normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || '');
}

export function withBasePath(path: string): string {
  return getBasePath() + path;
}
