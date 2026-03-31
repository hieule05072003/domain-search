import express from 'express';
import helmet from 'helmet';
import path from 'path';
import domainCheckRoutes from './routes/domain-check-routes';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter } from './middleware/rate-limiter';
import { cacheMiddleware } from './middleware/cache-middleware';

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// JSON parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files (CSS, browser JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rate limiting on API routes — 10 req/min per IP
app.use('/api', apiRateLimiter);

// Cache middleware — lookup: 24h, suggestions: 48h
app.use('/api/check', cacheMiddleware('lookup', 86400));
app.use('/api/suggest', cacheMiddleware('suggest', 172800));

// Routes
app.use('/', domainCheckRoutes);

// Error handler — must be last
app.use(errorHandler);

export default app;
