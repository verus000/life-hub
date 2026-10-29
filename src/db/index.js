'use strict';

const TYPES = ['json', 'sqlite', 'mysql', 'postgres'];

const INSTALL_HINT = {
  mysql: 'MySQL 适配器需要驱动，请先执行：npm i mysql2',
  postgres: 'PostgreSQL 适配器需要驱动，请先执行：npm i pg'
};

function create(database) {
  const type = String((database && database.type) || '').toLowerCase();
  if (TYPES.indexOf(type) < 0) {
    throw new Error('不支持的数据库类型 "' + type + '"，可选：' + TYPES.join(' / '));
  }
  try {
    switch (type) {
      case 'json': return require('./json-adapter')(database.json);
      case 'sqlite': return require('./sqlite-adapter')(database.sqlite);
      case 'mysql': return require('./mysql-adapter')(database.mysql);
      case 'postgres': return require('./postgres-adapter')(database.postgres);
    }
  } catch (e) {
    if (e && e.code === 'MODULE_NOT_FOUND' && INSTALL_HINT[type]) {
      throw new Error(INSTALL_HINT[type]);
    }
    throw e;
  }
}

module.exports = { create, TYPES };
