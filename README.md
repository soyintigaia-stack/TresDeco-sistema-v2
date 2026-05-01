# TresDeco — Sistema Operativo v1.0

Sistema de gestión de producción para TresDeco Amoblamientos.

## Variables de entorno requeridas en Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://qnhassbkxiwufswkszyo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

## Estructura

- `/app/page.tsx` — Selector de rol (Dante / Claudio)
- `/app/dashboard/page.tsx` — Dashboard de Dante
- `/app/taller/page.tsx` — Vista de Claudio
- `/lib/supabase.ts` — Cliente y tipos

## Deploy

1. Subir a GitHub
2. Conectar en Vercel
3. Agregar variables de entorno
4. Deploy automático
