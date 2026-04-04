/**
 * auth-routes.ts
 * Google OAuth 2.0 routes: login, callback, logout, current user.
 */

import { Router, Request, Response, NextFunction } from 'express';
import passport from '../middleware/auth-middleware';

const router = Router();

// Redirect to Google login page
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google redirects here after user grants/denies access
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
  (_req: Request, res: Response) => {
    res.redirect('/');
  }
);

// Destroy session and redirect home
router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

// Return current user as JSON (used by frontend to check login state)
router.get('/user', (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

export default router;
