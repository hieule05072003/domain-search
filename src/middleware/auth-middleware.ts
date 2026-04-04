/**
 * auth-middleware.ts
 * Configures Passport.js with Google OAuth 2.0 strategy.
 * No database — user is stored entirely in the session.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';

// Minimal user shape stored in session
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  photo: string;
}

// Extend Express.User to match our SessionUser
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends SessionUser {}
  }
}

// Serialize: store full user object in session (no DB needed for MVP)
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize: user object is already stored in session
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Google OAuth 2.0 strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: '/auth/google/callback',
    },
    (_accessToken, _refreshToken, profile, done) => {
      const user: SessionUser = {
        id: profile.id,
        email: profile.emails?.[0]?.value ?? '',
        name: profile.displayName ?? '',
        photo: profile.photos?.[0]?.value ?? '',
      };
      return done(null, user);
    }
  )
);

// express-session config — exported so app.ts can use it
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});

export default passport;
