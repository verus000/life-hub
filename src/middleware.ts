import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/constants';

/* 页面级快速闸门：只检查 Cookie 存在性，真正的会话校验在页面与 API 层做 */
const PUBLIC_PATHS = ['/login', '/register', '/verify'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && !PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
