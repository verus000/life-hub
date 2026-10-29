/* 类型化错误：Route Handler 捕获后统一映射为 { error } JSON，不外泄堆栈 */

export class AppError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new AppError(400, message);
export const unauthorized = (message = '请先登录') => new AppError(401, message);
export const forbidden = (message: string, code?: string) => new AppError(403, message, code);
export const notFound = (message = '记录不存在') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const tooManyRequests = (message: string) => new AppError(429, message);
