import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import path from 'path';
import domainCheckRoutes from './routes/domain-check-routes';
import authRoutes from './routes/auth-routes';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter } from './middleware/rate-limiter';
import { cacheMiddleware } from './middleware/cache-middleware';
import { sessionMiddleware } from './middleware/auth-middleware';
import passport from './middleware/auth-middleware';

const app = express();

// Trust proxy (Render runs behind a reverse proxy — needed for secure cookies + HTTPS detection)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session — must come before passport
app.use(sessionMiddleware);

// Passport auth
app.use(passport.initialize());
app.use(passport.session());

// Expose current user to all EJS templates
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.user = req.user ?? null;
  next();
});

// EJS template engine — in dev __dirname=src/, in prod __dirname=dist/
// Views are always in src/views (not compiled by tsc)
app.set('view engine', 'ejs');
const viewsPath = path.join(__dirname, '..', 'src', 'views');
app.set('views', viewsPath);

// Static files (CSS, browser JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting on API routes — 10 req/min per IP
app.use('/api', apiRateLimiter);

// Cache middleware — lookup: 24h, suggestions: 48h, pricing: 12h
app.use('/api/check', cacheMiddleware('lookup', 86400));
app.use('/api/suggest', cacheMiddleware('suggest', 172800));
app.use('/api/pricing', cacheMiddleware('pricing', 43200));

// Auth routes
app.use('/auth', authRoutes);

// App routes
app.use('/', domainCheckRoutes);

// Error handler — must be last
app.use(errorHandler);

export default app;
