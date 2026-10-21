import 'dotenv/config';
import { execSync } from 'node:child_process';
import { assertTestDatabaseUrl } from './guard';

// Se ejecuta una vez antes de todos los tests: aplica las migraciones en la base de prueba.
export default function setup() {
  const url = assertTestDatabaseUrl(process.env['DATABASE_URL_TEST']);
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
}
