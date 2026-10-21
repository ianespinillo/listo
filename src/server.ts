import 'dotenv/config';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'node:path';
import { prisma } from './server/db';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());
app.use(cookieParser());

/**
 * API. Se monta antes de los estáticos y del handler de Angular.
 */
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({
      error: 'BASE_NO_DISPONIBLE',
      mensaje: 'No se pudo conectar con la base de datos. Intentá de nuevo en unos minutos.',
    });
  }
});

// Cualquier otra ruta /api/* responde JSON y nunca llega a Angular.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'No existe el recurso solicitado.' });
});

/**
 * Estáticos desde /browser.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * El resto de las rutas las resuelve Angular (todas con RenderMode.Client).
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Arranca el servidor si este módulo es el punto de entrada o si corre con PM2.
 * Escucha en `PORT` o, por defecto, en 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Servidor Express escuchando en http://localhost:${port}`);
  });
}

/**
 * Handler que usa la CLI de Angular (dev server y build).
 */
export const reqHandler = createNodeRequestHandler(app);
