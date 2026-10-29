/* 邮件发送：console 模式打印验证链接（本地开发），smtp 模式走 nodemailer。
   行为与原 src/auth.js 的邮件逻辑一致。 */

import { getAppUrl, loadConfig } from '../config';

export interface OutboxMail {
  to: string;
  subject: string;
  text: string;
  url: string;
}

const outbox: OutboxMail[] = [];

type Transporter = { sendMail(mail: OutboxMail): Promise<{ messageId: string }> };

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;
  const cfg = loadConfig();
  if (cfg.MAIL_MODE === 'console') {
    transporter = {
      async sendMail(mail) {
        outbox.push(mail);
        console.log('[邮件·控制台模式] 收件人 ' + mail.to + ' 主题：' + mail.subject + '\n' + mail.text);
        return { messageId: 'console-' + Date.now() };
      },
    };
    return transporter;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = (await import('nodemailer')) as typeof import('nodemailer');
  transporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_PORT === 465,
    auth: cfg.SMTP_USER ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS || '' } : undefined,
  });
  return transporter;
}

export async function sendVerificationMail(email: string, verifyToken: string): Promise<void> {
  const url = getAppUrl() + '/verify?token=' + verifyToken;
  const mail = {
    to: email,
    subject: '生活管理 · 邮箱验证',
    text:
      '你好！请在 24 小时内点击以下链接完成注册：\n\n' + url +
      '\n\n如果这不是你本人的操作，请忽略本邮件。',
    url,
  };
  try {
    await (await getTransporter()).sendMail(mail);
  } catch (e) {
    throw new Error('验证邮件发送失败：' + (e instanceof Error ? e.message : 'SMTP 异常'));
  }
}

/* 测试断言用：读取控制台模式发出的邮件 */
export function getOutbox(): OutboxMail[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}
