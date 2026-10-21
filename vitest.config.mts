import { defineConfig } from 'vitest/config';

// Solo los tests de la lógica del servidor. Los tests de Angular no usan esta configuración.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/server/**/*.test.ts'],
  },
});
