# Campus Brújula Personal

Panel privado y autónomo para gestión de vida universitaria y personal: tareas, entregas de Moodle (TecnoCampus), calendario y correo.

## Características

- **Universidad & Moodle**: Sincronización automática de entregas y exámenes vía exportación de calendario iCal / archivo `.ics`. La sincronización se limita en el servidor (como máximo una vez cada 30 min) y puede programarse por cron.
- **Calendario unificado**: Tareas y eventos integrados sin duplicados.
- **Gmail**: Bandeja de entrada de solo lectura para consulta rápida.
- **Recordatorios de entregas**: Notificaciones del navegador (opt-in desde Ajustes) para tareas que vencen hoy o mañana.
- **Paleta de comandos (⌘K / Ctrl+K)**: Salto rápido entre secciones, nueva tarea y enlaces rápidos.
- **Notas y enlaces rápidos**: Acceso directo a portales académicos y apuntes.
- **Autónomo e independiente**: Funciona con tu propia base de datos de Supabase y sin ataduras a plataformas propietarias.

## Configuración y Variables de Entorno

Crea o edita tu archivo `.env` en la raíz del proyecto:

```env
# Supabase (Tu propio proyecto)
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="tu_clave_publica_de_supabase"
SUPABASE_SERVICE_ROLE_KEY="tu_clave_service_role_secreta"

VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="tu_clave_publica_de_supabase"

# Gmail (Opcional)
GOOGLE_ACCESS_TOKEN="tu_token_de_acceso_opcional"

# Sincronización programada de Moodle (Opcional)
CRON_SECRET="un_secreto_largo_y_aleatorio"
```

## Sincronización programada (cron)

Para mantener Moodle al día sin abrir el panel, hay un endpoint protegido por secreto:

```
POST /api/cron/sync
Authorization: Bearer <CRON_SECRET>
```

Configúralo en tu proveedor de cron (p. ej. Vercel Cron, GitHub Actions o `cron` del sistema).
Durante una rotación de secreto puedes definir `CRON_SECRET_PREVIOUS` para aceptar el valor
anterior temporalmente. Sin `CRON_SECRET` configurado, el endpoint responde `500`.

## Desarrollo Local

1. Instala las dependencias:
```sh
npm install
```

2. Inicia el servidor de desarrollo:
```sh
npm run dev
```

3. Abre [http://localhost:3000](http://localhost:3000) (o el puerto indicado en la terminal).
