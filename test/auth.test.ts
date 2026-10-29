/* 认证服务回归：注册、验证、登录、限流、数据认领（对应原自测的 auth 部分） */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  deleteSession,
  getSessionUser,
  login,
  register,
  resend,
  verify,
} from '@/server/auth/service';
import { getDb } from '@/server/db';
import { listItems } from '@/server/items/service';
import { AppError } from '@/server/errors';
import { clearMail, freshDb, setupEnv, verifyTokenFromOutbox } from './helpers';

let seq = 0;
const nextEmail = () => 'user' + ++seq + '@test.dev';

beforeAll(() => {
  setupEnv();
});

describe('注册与验证', () => {
  it('注册创建未激活用户并发送验证邮件', async () => {
    const db = freshDb();
    clearMail();
    const r = await register(db, 'SMOKE@test.dev ', 'pass-word-123', 'ip-1');
    expect(r.message).toContain('查收验证邮件');
    const token = verifyTokenFromOutbox();

    /* 未激活登录被拒 */
    await expect(login(db, 'smoke@test.dev', 'pass-word-123', 'ip-2')).rejects.toMatchObject({
      status: 403,
    });

    const result = await verify(db, token);
    expect(result.email).toBe('smoke@test.dev');
    expect(result.claimed).toBe(0);

    /* 激活后可登录 */
    const lg = await login(db, 'smoke@test.dev', 'pass-word-123', 'ip-3');
    expect(lg.user.email).toBe('smoke@test.dev');
  });

  it('重复注册已激活邮箱被拒绝', async () => {
    const db = freshDb();
    clearMail();
    await register(db, 'dup@test.dev', 'pass-word-123', 'ip-a');
    await verify(db, verifyTokenFromOutbox());
    await expect(register(db, 'dup@test.dev', 'another-456', 'ip-b')).rejects.toMatchObject({ status: 400 });
  });

  it('无效邮箱与短密码返回 400', async () => {
    const db = freshDb();
    await expect(register(db, 'not-an-email', 'pass-word-123', 'ip-c')).rejects.toMatchObject({ status: 400 });
    await expect(register(db, nextEmail(), 'short', 'ip-d')).rejects.toMatchObject({ status: 400 });
  });

  it('过期或伪造令牌返回 400', async () => {
    const db = freshDb();
    await expect(verify(db, 'f'.repeat(64))).rejects.toMatchObject({ status: 400 });
    await expect(verify(db, 'bad-token')).rejects.toMatchObject({ status: 400 });
  });

  it('首个激活用户认领旧版数据，后续用户从空开始', async () => {
    const db = freshDb();
    clearMail();
    /* 直接向库中写入旧版无主数据 */
    db.$client
      .prepare("INSERT INTO items (category, title, amount, created_at, updated_at) VALUES ('phone', '旧数据', 19, '2025-01-01', '2025-01-01')")
      .run();

    await register(db, 'first@test.dev', 'pass-word-123', 'ip-e');
    const r1 = await verify(db, verifyTokenFromOutbox());
    expect(r1.claimed).toBe(1);
    const first = await getSessionUser(db, r1.session.token);
    expect(first!.email).toBe('first@test.dev');
    expect((await listItems(db, first!.id)).length).toBe(1);

    await register(db, 'second@test.dev', 'pass-word-123', 'ip-f');
    const r2 = await verify(db, verifyTokenFromOutbox());
    const second = (await getSessionUser(db, r2.session.token))!;
    expect(second.email).toBe('second@test.dev');
    expect((await listItems(db, second.id)).length).toBe(0);
  });
});

describe('登录安全', () => {
  it('密码错误与不存在用户统一提示', async () => {
    const db = freshDb();
    clearMail();
    await register(db, 'safe@test.dev', 'pass-word-123', 'ip-g');
    await verify(db, verifyTokenFromOutbox());
    const wrong = login(db, 'safe@test.dev', 'wrong-pass-999', 'ip-h');
    await expect(wrong).rejects.toMatchObject({ status: 401, message: '邮箱或密码错误' });
    const missing = login(db, 'ghost@test.dev', 'whatever-999', 'ip-i');
    await expect(missing).rejects.toMatchObject({ status: 401, message: '邮箱或密码错误' });
  });
});

describe('会话', () => {
  it('有效令牌解析用户，登出后失效', async () => {
    const db = freshDb();
    clearMail();
    await register(db, 'sess@test.dev', 'pass-word-123', 'ip-j');
    await verify(db, verifyTokenFromOutbox());
    const lg = await login(db, 'sess@test.dev', 'pass-word-123', 'ip-k');
    const user = await getSessionUser(db, lg.session.token);
    expect(user?.email).toBe('sess@test.dev');
    await deleteSession(db, lg.session.token);
    expect(await getSessionUser(db, lg.session.token)).toBeNull();
  });

  it('伪造令牌不产生会话', async () => {
    expect(await getSessionUser(freshDb(), 'a'.repeat(64))).toBeNull();
    expect(await getSessionUser(freshDb(), undefined)).toBeNull();
  });
});

describe('限流', () => {
  it('连续登录失败超过阈值返回 429', async () => {
    const db = freshDb();
    for (let i = 0; i < 20; i++) {
      await login(db, 'nobody@test.dev', 'bad-pass-000', 'rate-ip').catch(() => undefined);
    }
    await expect(login(db, 'nobody@test.dev', 'bad-pass-000', 'rate-ip')).rejects.toBeInstanceOf(AppError);
  });

  it('resend 幂等返回统一提示', async () => {
    const db = freshDb();
    const r = await resend(db, 'anyone@test.dev', 'resend-ip');
    expect(r.message).toContain('若该邮箱已注册');
  });
});
