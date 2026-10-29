import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve('docker-entrypoint.cjs'), 'utf8');

function boot(initialUid: number, ownershipError?: string) {
  const state = { uid: initialUid, gid: initialUid, groups: [initialUid], started: false, repaired: [] as string[] };
  const start = () => vm.runInNewContext(source, {
    process: {
      env: { DB_FILE_NAME: '/data/life-hub.db' },
      getuid: () => state.uid,
      setuid: (uid: number) => { state.uid = uid; },
      setgid: (gid: number) => { state.gid = gid; },
      setgroups: (groups: number[]) => { state.groups = groups; },
    },
    require(name: string) {
      if (name === 'node:path') return path.posix;
      if (name === 'node:fs') return {
        mkdirSync() {},
        chownSync(target: string) {
          if (ownershipError) throw Object.assign(new Error('ownership error'), { code: ownershipError });
          state.repaired.push(target);
        },
      };
      if (name === './server.js') {
        expect(state.uid).not.toBe(0);
        expect(state.gid).not.toBe(0);
        expect(state.groups).not.toContain(0);
        state.started = true;
        return {};
      }
      throw new Error('Unexpected module: ' + name);
    },
  });
  return { state, start };
}

describe('Docker 卷升级入口', () => {
  it('旧 root 卷修正权限后，应用以非 root 身份启动', () => {
    const { state, start } = boot(0);
    start();
    expect(state.started).toBe(true);
    expect(state.uid).toBe(1001);
    expect(state.repaired).toEqual(expect.arrayContaining(['/data', '/data/life-hub.db', '/data/life-hub.db-wal', '/data/life-hub.db-shm']));
  });

  it('非 root 启动不会尝试改文件权限', () => {
    const { state, start } = boot(1001);
    start();
    expect(state.started).toBe(true);
    expect(state.repaired).toEqual([]);
  });

  it('缺少旧数据库不阻止首次启动，真实权限错误则中止启动', () => {
    const fresh = boot(0, 'ENOENT');
    fresh.start();
    expect(fresh.state.started).toBe(true);
    const denied = boot(0, 'EACCES');
    expect(denied.start).toThrow('ownership error');
    expect(denied.state.started).toBe(false);
  });
});
