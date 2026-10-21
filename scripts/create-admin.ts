// Crea o actualiza la usuaria del panel. Uso: `pnpm create-admin`.
// Uso no interactivo (pruebas): definir ADMIN_EMAIL y ADMIN_PASSWORD y no se pregunta nada.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../src/server/db';

const BCRYPT_COST = 12;

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('El email no es válido.')),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

// Lectura por consola; con `hidden` no se muestra lo que se escribe.
function ask(text: string, hidden = false): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!muted) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
    muted = hidden;
  });
}

async function getCredentials(): Promise<{ email: string; password: string }> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) return { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

  const email = await ask('Email de la usuaria: ');
  const password = await ask('Contraseña (mínimo 8 caracteres): ', true);
  const repeated = await ask('Repetí la contraseña: ', true);
  if (password !== repeated) throw new Error('Las contraseñas no coinciden.');
  return { email, password };
}

async function main() {
  const credentials = schema.safeParse(await getCredentials());
  if (!credentials.success) {
    throw new Error(credentials.error.issues.map((i) => i.message).join(' '));
  }
  const { email, password } = credentials.data;
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    await prisma.admin.update({ where: { email }, data: { passwordHash } });
    console.log(`Usuaria actualizada: ${email}.`);
  } else {
    await prisma.admin.create({ data: { email, passwordHash } });
    console.log(`Usuaria creada: ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
