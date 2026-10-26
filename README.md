# Campus Brújula Personal

Panel privado y autónomo para gestión de vida universitaria y personal: tareas, entregas de Moodle (TecnoCampus), calendario y correo.

## Características

- **Universidad & Moodle**: Sincronización automática de entregas y exámenes vía exportación de calendario iCal / archivo `.ics`.
- **Calendario unificado**: Tareas y eventos integrados sin duplicados.
- **Gmail**: Bandeja de entrada de solo lectura para consulta rápida.
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
```

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
