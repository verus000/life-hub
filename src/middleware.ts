import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/constants';

/* 页面级快速闸门：只检查 Cookie 存在性，真正的会话校验在页面与 API 层做 */
const PUBLIC_PATHS = ['/login', '/register', '/verify'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  /* 兼容旧版邮件 /?verify=token，必须在登录闸门之前处理。 */
  if (pathname === '/' && req.nextUrl.searchParams.has('verify')) {
    const url = req.nextUrl.clone();
    url.pathname = '/verify';
    url.search = '';
    url.searchParams.set('token', req.nextUrl.searchParams.get('verify') || '');
    return NextResponse.redirect(url);
  }

  if (!hasSession && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  /* 登录/注册页在 server component 校验真实会话，不能仅凭 Cookie 跳首页。 */
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
