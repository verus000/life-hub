/* 会话 Cookie 名称。独立成文件：middleware 运行在 Edge 运行时，
   不能导入 service（会连带 node:crypto / bcryptjs / nodemailer 进 Edge 包）。 */
export const SESSION_COOKIE = 'life_hub_session';
