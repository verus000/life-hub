'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* 兼容旧版 root 创建的卷，只处理数据库及 SQLite 的配套文件。 */
if (process.getuid && process.getuid() === 0) {
  const file = path.resolve(process.env.DB_FILE_NAME || '/data/life-hub.db');
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  for (const target of [dir, file, file + '-wal', file + '-shm', file + '-journal']) {
    try {
      fs.chownSync(target, 1001, 1001);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  process.setgroups([]);
  process.setgid(1001);
  process.setuid(1001);
}

require('./server.js');
