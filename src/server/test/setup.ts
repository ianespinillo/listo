// Corre en cada worker antes de importar el código del servidor: fuerza la base de prueba.
import 'dotenv/config';
import { assertTestDatabaseUrl } from './guard';

process.env['DATABASE_URL'] = assertTestDatabaseUrl(process.env['DATABASE_URL_TEST']);
