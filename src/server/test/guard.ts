// Guarda de seguridad: los tests solo pueden correr contra la base de prueba.

export function assertTestDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('Falta DATABASE_URL_TEST: los tests necesitan la base de prueba.');
  }
  const url = new URL(value);
  if (url.port !== '5433' || url.pathname !== '/listo_test') {
    throw new Error(
      'DATABASE_URL_TEST no apunta a la base de prueba (puerto 5433, base listo_test). ' +
        'Se aborta para no tocar otra base.',
    );
  }
  return value;
}
