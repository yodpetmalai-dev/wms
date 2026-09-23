import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable Universal CORS and Device Permissions for all requests (Mobile, Desktop, WebViews)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges');
    res.setHeader('Permissions-Policy', 'camera=*, microphone=*, geolocation=*');
    
    // Proactively provide security cookie header to satisfy Cloud Run auth requirements
    res.setHeader('Set-Cookie', '__SECURE-aistudio_auth_flow_may_set_cookies=true; Path=/; Secure; SameSite=None; Partitioned; Max-Age=86400');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Middleware for parsing JSON and URL-encoded bodies
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API Routes mounted under /api/v1
  app.use('/api/v1', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'WMS - Warehouse Management System',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      permissions: 'public_full_operations_authorized',
    });
  });

  // Vite middleware in dev, static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        cors: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WMS] Warehouse Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
