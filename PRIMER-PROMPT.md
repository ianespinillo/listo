# Primer mensaje para Claude Code

Copiá y pegá esto como primer mensaje, con la terminal parada en la carpeta del proyecto
(donde están `CLAUDE.md`, `docs/` y `prisma/`):

---

Vamos a construir "Listo", el sistema del listado institucional del Decreto 900/23.
Todo el contexto está en `CLAUDE.md` y en `docs/`.

1. Leé `CLAUDE.md` y todos los archivos de `docs/`, incluido `docs/diseno.md`. Abrí los
   mockups de `docs/diseno/mockups/` para entender cómo se ve cada pantalla.
2. Antes de escribir código, decime en pocas líneas si algo de la documentación te parece
   contradictorio o incompleto.
3. Después arrancá la **Etapa 0** de `docs/plan.md`. Creá el proyecto Angular con SSR **en
   esta misma carpeta**, sin pisar `CLAUDE.md`, `docs/`, `prisma/`, `docker-compose.yml`
   ni `.env.example`.
4. Al terminar la etapa, frená y mostrame cómo probarla.

Respondeme siempre en español.

---

## Para las etapas siguientes

> Seguí con la Etapa N de `docs/plan.md`.

Si querés revisar antes de que avance, agregá: "Antes de implementar, mostrame el plan de la
etapa y esperá mi OK."
