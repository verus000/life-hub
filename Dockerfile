# 生活管理 · Docker 镜像
# 构建：docker build -t life-hub .
# 运行：docker run -p 8787:8787 --env-file .env -v life-hub-data:/app/data life-hub
# 说明：默认 SQLite 依赖 Node 内置 node:sqlite，需 Node 22+ 基础镜像
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src
COPY public ./public
COPY tools ./tools

# 容器内默认监听所有网卡；数据落在 /app/data 卷中
ENV HOST=0.0.0.0 \
    PORT=8787 \
    DB_TYPE=sqlite \
    DB_FILE=/app/data/life-hub.db

VOLUME /app/data
EXPOSE 8787

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
