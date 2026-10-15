# Cooperaciones 1° Medio

Aplicación para coordinar las 45 cooperaciones de la convivencia de 1° Medio por el Día del Profesor. Los apoderados pueden reservar varios cupos, confirmar con el nombre del alumno y ver los cambios en tiempo real.

## Funcionalidades

- 45 cupos agrupados en leches, jugos, sándwiches, magdalenas, compotas y galletas.
- Reserva temporal de cinco minutos al seleccionar un cupo.
- Confirmación atómica: dos personas no pueden adjudicarse el mismo cupo.
- Actualización en tiempo real mediante Supabase Realtime, con sondeo de respaldo.
- Nombres de alumnos visibles en los cupos confirmados.
- Panel `/admin` protegido para corregir nombres, liberar cupos y exportar CSV.
- Página marcada como `noindex`.

## Stack

- Next.js 16 con App Router y TypeScript.
- Supabase Postgres + Realtime.
- Vercel.

## Configuración

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Conecta un proyecto Supabase desde Vercel Marketplace y descarga las variables:

   ```bash
   vercel env pull .env.local --yes
   ```

3. Agrega en Vercel `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET`. Usa una contraseña larga y un secreto aleatorio de al menos 32 bytes.

4. Ejecuta [`supabase/migrations/202610150001_initial_schema.sql`](supabase/migrations/202610150001_initial_schema.sql) una sola vez en el SQL Editor de Supabase. La migración crea las tablas, los 45 cupos, las políticas y las funciones atómicas.

5. Verifica que las variables descritas en [`.env.example`](.env.example) estén presentes y ejecuta:

   ```bash
   npm run dev
   ```

## Comandos de verificación

```bash
npm run typecheck
npm run lint
npm run build
```

## Estados de un cupo

- `available`: se puede seleccionar.
- `held`: reservado durante cinco minutos por una sesión.
- `confirmed`: asignado definitivamente al alumno indicado.

Las mutaciones públicas solo se realizan mediante funciones SQL con bloqueo de fila. La tabla de tokens de reserva no tiene permisos públicos.

## Administración

Visita `/admin`, ingresa `ADMIN_PASSWORD` y usa el panel para editar nombres, liberar registros erróneos o descargar el CSV. La sesión administrativa se almacena en una cookie `httpOnly` firmada con `ADMIN_SESSION_SECRET` y expira después de ocho horas.
