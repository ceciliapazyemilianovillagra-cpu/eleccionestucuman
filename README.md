# Pulso Electoral — Elecciones Tucumán 2027

Plataforma de gestión territorial y fiscalización electoral. Producción: https://eleccionestucuman.vercel.app

## Qué hay

- `/` — panel interno (superadmin, admin, dirigentes): padrón, roles, bloques, mapa, agenda, comicios.
- `/comicios` — portal externo para candidatos, dirigentes, movilizadores, choferes y fiscales (celular, funciona sin señal).

Next.js 16 (App Router) + Supabase (proyecto `dcdtbinqlsvsvmrymyjr`, región sa-east-1), desplegado en Vercel.

## Estructura

- `src/app/panel/` — pantallas del panel interno (el cliente habla directo con Supabase, protegido por RLS).
- `src/app/external/` y `src/app/comicios/` — portal externo. Toda su lógica de servidor vive en la Edge Function `comicios`.
- `src/app/external/offlineQueue.ts` — cola offline de los reportes de fiscales.

## Aislamiento entre bloques

`bloques` → `candidatos.bloque_id` → `person_roles.bloque_id`. Las políticas RLS y la Edge Function filtran por bloque; el padrón es compartido. El superadmin ve todo.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

No hay variables de entorno: la URL y la clave pública (anon) de Supabase están en `src/app/panel/shared.ts` y `src/app/external/api.ts`.

## Backend (Supabase)

Edge Functions activas: `comicios` (portal externo), `manage-users`, `agenda-whatsapp`, `media-monitor`. Las demás están dadas de baja (responden 410). Storage: bucket `actas` (privado, fotos de acta) y `branding` (público).

El código de las funciones y el esquema SQL todavía se administran desde Supabase y no están versionados en este repositorio.
