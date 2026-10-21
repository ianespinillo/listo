import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Solo los tests de la lógica del servidor. Los tests de Angular no usan esta configuración.
// Los tests usan SIEMPRE la base de prueba (DATABASE_URL_TEST): `setupFiles` pisa DATABASE_URL
// antes de importar src/server/db.ts, y `globalSetup` aplica las migraciones.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/**/*.test.ts'],
    globalSetup: ['src/server/test/global-setup.ts'],
    setupFiles: ['src/server/test/setup.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
