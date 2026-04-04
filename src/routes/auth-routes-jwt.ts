/**
 * Google OAuth 2.0 routes for CF Workers — no Passport, no sessions.
 * Uses manual OAuth flow + JWT stored in HttpOnly cookie.
 */
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import type { JwtUser } from '../middleware/jwt-auth-middleware';

type AuthEnv = { Bindings: Record<string, string>; Variables: { user: JwtUser | null } };

const auth = new Hono<AuthEnv>();

/** Redirect to Google OAuth consent screen */
auth.get('/google', (c) => {
  const origin = new URL(c.req.url).origin;
  const params = new URLSearchParams({
    client_id: (c.env as any).GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/** Exchange authorization code for user info, sign JWT, set cookie */
auth.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.redirect('/?auth=failed');

  const origin = new URL(c.req.url).origin;
  const env = c.env as any;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return c.redirect('/?auth=failed');

    // Fetch user profile
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await userRes.json()) as {
      id: string;
      email: string;
      name: string;
      picture: string;
    };

    // Sign JWT (24h expiry)
    const token = await sign(
      {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        photo: profile.picture,
        exp: Math.floor(Date.now() / 1000) + 86400,
      },
      env.JWT_SECRET
    );

    setCookie(c, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 86400,
      path: '/',
    });

    return c.redirect('/');
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err);
    return c.redirect('/?auth=failed');
  }
});

/** Clear auth cookie and redirect home */
auth.get('/logout', (c) => {
  deleteCookie(c, 'auth_token', { path: '/' });
  return c.redirect('/');
});

/** Return current user from JWT (or null) */
auth.get('/user', (c) => {
  const user = c.get('user');
  return c.json({ user: user || null });
});

export default auth;
