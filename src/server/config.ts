import { z } from 'zod';
import { getBasePath } from '@/lib/base-path';

/* 集中环境变量校验：Next.js 自动加载 .env，这里只做归并与快速失败 */

const envSchema = z.object({
  APP_URL: z.string().default(''),
  EMAIL_VERIFICATION_REQUIRED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  MAIL_MODE: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => i.path.join('.') + '：' + i.message)
      .join('；');
    throw new Error('环境变量校验失败：' + detail);
  }
  const cfg = parsed.data;
  if (cfg.EMAIL_VERIFICATION_REQUIRED && cfg.MAIL_MODE === 'smtp' && !cfg.SMTP_HOST) {
    throw new Error('MAIL_MODE=smtp 但未配置 SMTP_HOST，请设置 SMTP 环境变量或将 MAIL_MODE 设为 console');
  }
  cached = cfg;
  return cfg;
}

/* 测试需要重置缓存 */
export function resetConfigCache(): void {
  cached = null;
}

/* 拼接激活链接用：未配置时按 Next 默认端口推导 */
export function getAppUrl(): string {
  const cfg = loadConfig();
  const raw = cfg.APP_URL || 'http://127.0.0.1:3000' + getBasePath();
  return raw.replace(/\/+$/, '');
}
