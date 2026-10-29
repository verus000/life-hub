# Next.js standalone 多阶段构建：最终镜像只含运行所需文件
# 构建：docker build -t life-hub .
# 运行：docker run -p 8787:3000 --env-file .env -e DB_FILE_NAME=/data/life-hub.db -v life-hub-data:/data life-hub
# 说明：SQLite 依赖 Node 内置 node:sqlite，需 Node 22.5+ 基础镜像
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_FILE_NAME=/data/life-hub.db
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p /data && chown nextjs:nodejs /data
COPY docker-entrypoint.cjs ./docker-entrypoint.cjs
EXPOSE 3000
# 旧镜像以 root 写入数据卷；入口修正数据库权限后立刻降权运行应用。
CMD ["node", "docker-entrypoint.cjs"]
