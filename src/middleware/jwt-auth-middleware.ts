/**
 * JWT auth middleware for Hono on CF Workers.
 * Reads JWT from HttpOnly cookie, verifies, attaches user to context.
 */
import { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export interface JwtUser {
  id: string;
  email: string;
  name: string;
  photo: string;
}

/** Decode JWT from cookie, set user on context (null if not authenticated) */
export function jwtAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (token) {
      try {
        const payload = await verify(token, (c.env as any).JWT_SECRET, 'HS256');
        c.set('user', payload as unknown as JwtUser);
      } catch {
        // Invalid or expired token — treat as logged out
        c.set('user', null);
      }
    } else {
      c.set('user', null);
    }
    await next();
  };
}
