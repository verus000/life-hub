import type { NextConfig } from 'next';
import { getBasePath } from './src/lib/base-path';

const basePath = getBasePath();

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // 现有预览可能占用默认产物；验证时可显式选择独立目录。
  distDir: process.env.LIFE_HUB_DIST_DIR || '.next',
  serverExternalPackages: ['nodemailer'],
};

export default nextConfig;
