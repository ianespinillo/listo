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
import { createApiRouter } from './server/api';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Detrás de un proxy (nginx, PM2 + proxy) hay que decir cuántos saltos confiar para que el rate
 * limit vea la IP real. TRUST_PROXY: vacío = apagado, número = cantidad de saltos, "true" = confiar.
 */
const trustProxy = process.env['TRUST_PROXY']?.trim();
if (trustProxy) {
  app.set('trust proxy', trustProxy === 'true' ? true : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

app.use(cookieParser());

/**
 * API. Se monta antes de los estáticos y del handler de Angular.
 * El router parsea su propio JSON y responde 404 en JSON para cualquier /api/* desconocido.
 */
app.use('/api', createApiRouter());

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
