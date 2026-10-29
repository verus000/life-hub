'use strict';

const { sendJson, readBody } = require('./http');
const Records = require('../public/assets/js/records');

module.exports = function makeRoutes(db, auth) {
  let mutationQueue = Promise.resolve();
  function mutate(task) {
    const result = mutationQueue.then(task);
    mutationQueue = result.catch(() => {});
    return result;
  }

  async function handle(req, res, url) {
    const p = url.pathname;
    const withId = /^\/api\/items\/(\d+)$/.exec(p);

    try {
      if (p === '/api/health') {
        return sendJson(res, 200, { ok: true, database: db.describe() });
      }

      /* 认证端点：公开访问 */
      if (p === '/api/auth/register' && req.method === 'POST') {
        return auth.register(req, res, await readBody(req));
      }
      if (p === '/api/auth/verify' && req.method === 'GET') {
        return auth.verify(req, res, url);
      }
      if (p === '/api/auth/login' && req.method === 'POST') {
        return auth.login(req, res, await readBody(req));
      }
      if (p === '/api/auth/resend' && req.method === 'POST') {
        return auth.resend(req, res, await readBody(req));
      }
      if (p === '/api/auth/logout' && req.method === 'POST') {
        return auth.logout(req, res);
      }
      if (p === '/api/auth/me' && req.method === 'GET') {
        return auth.me(req, res);
      }

      /* 业务端点：需要登录，数据按用户隔离 */
      const user = await auth.requireUser(req, res);
      if (!user) return;

      if (p === '/api/items' && req.method === 'GET') {
        return sendJson(res, 200, await db.list(user.id));
      }

      if (p === '/api/items' && req.method === 'POST') {
        const body = await readBody(req);
        if (!body.title) return sendJson(res, 400, { error: '缺少必填字段 title' });
        const item = Records.validate(body);
        return sendJson(res, 201, await mutate(() => db.add(item, user.id)));
      }

      if (p === '/api/items/import' && req.method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.items)) throw new Error('items 必须是数组');
        const items = body.items.map((x, i) => {
          try { return Records.validate(x); }
          catch (e) { throw new Error('第 ' + (i + 1) + ' 条：' + e.message); }
        });
        const work = mutate(async () => {
          const batch = Records.partition(items, await db.list(user.id));
          const rows = await db.addMany(batch.items, user.id);
          return { created: rows.length, skipped: batch.skipped };
        });
        return sendJson(res, 201, await work);
      }

      if (p === '/api/items' && req.method === 'DELETE') {
        await mutate(() => db.clear(user.id));
        return sendJson(res, 200, { ok: true });
      }

      if (withId && req.method === 'PUT') {
        const body = await readBody(req), patch = Records.validate(body, true);
        return await mutate(async () => {
          if (body.expectedUpdatedAt !== undefined) {
            const current = (await db.list(user.id)).find(x => x.id === Number(withId[1]));
            if (current && current.updatedAt !== body.expectedUpdatedAt) return sendJson(res, 409, { error: '记录已在其他页面变更，请刷新后重试' });
          }
          const row = await db.update(withId[1], patch, user.id);
          return row ? sendJson(res, 200, row) : sendJson(res, 404, { error: '记录不存在' });
        });
      }

      if (withId && req.method === 'DELETE') {
        const gone = await mutate(() => db.remove(withId[1], user.id));
        return gone ? sendJson(res, 200, gone) : sendJson(res, 404, { error: '记录不存在' });
      }

      return sendJson(res, 404, { error: '接口不存在：' + req.method + ' ' + p });
    } catch (e) {
      return sendJson(res, 400, { error: e.message || '请求处理失败' });
    }
  }

  return handle;
};
