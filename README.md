# Brújula — panel del estudiante

Dashboard para estudiantes (universidad, FP, bachillerato, academias…): tareas, entregas, exámenes, horario, notas, horas de estudio y correo en un solo sitio. Multiusuario: cada estudiante tiene su cuenta y sus integraciones.

## Características

- **Calendarios iCal ilimitados**: Moodle, Canvas, Google Classroom, Blackboard, Teams, el horario de tu centro… Se sincronizan solos (como máximo cada 30 min por fuente) y por cron. Los exámenes se detectan por el título.
- **Agenda unificada**: tareas, entregas, exámenes y clases sin duplicados, con filtros por tipo.
- **Inicio configurable**: vencidas aparte de las próximas, «Ahora / Siguiente clase», cuenta atrás de exámenes, horas de estudio y racha. Cada widget se puede ocultar.
- **Tareas**: tipos (tarea, entrega, examen), subtareas, tiempo estimado, repetición, lista, tablero Kanban y calendario.
- **Calificaciones**: criterios de evaluación con pesos, media ponderada por asignatura y global (por créditos) y la calculadora «¿qué necesito sacar para aprobar o llegar a mi objetivo?».
- **Horario y asistencia**: horario semanal, pasar lista y aviso al acercarse al límite de faltas.
- **Estudio**: pomodoro y cronómetro que siguen funcionando al cambiar de página, estadísticas, racha, modo exámenes con plan de estudio automático y revisión semanal.
- **Asignaturas y apuntes**: ficha con profesor, aula, créditos y nota objetivo; notas en Markdown asociadas a cada asignatura.
- **IA (Claude)**: importar la guía docente en PDF (criterios y fechas), resumir correos y crear tareas con sus fechas, y planificar la semana.
- **Grupos**: tareas compartidas con compañeros mediante un código de invitación.
- **Finanzas**: ingresos (becas, trabajo), gastos por categoría y suscripciones mensuales.
- **Gmail de solo lectura** con OAuth por usuario.
- **Recordatorios**: notificaciones push (PWA instalable) y resumen diario por email.
- **Exportar** tu agenda como feed iCal para Google Calendar, Apple Calendar u Outlook.
- **Paleta de comandos (⌘K / Ctrl+K)** y navegación inferior en el móvil.

## Puesta en marcha

1. Copia `.env.example` a `.env` y rellena al menos el bloque «Obligatorias». Cada variable opcional activa su función y, si falta, la interfaz la oculta o lo indica.
2. Aplica las migraciones de `drizzle/migrations/` en orden (`0000`, `0001`, `0002`) desde el editor SQL de Supabase, o con `DATABASE_URL=… npx drizzle-kit migrate`.
3. Instala las dependencias y arranca:

```sh
npm install
npm run dev
```

4. Abre [http://localhost:3000](http://localhost:3000). Las cuentas nuevas pasan por un onboarding de 3 pasos.

### Gmail (OAuth por usuario)

En Google Cloud Console crea un ID de cliente OAuth de tipo «Aplicación web», activa la Gmail API y añade la URI de redirección `<APP_URL>/api/google/callback`. El permiso que se pide es `gmail.readonly`. Mientras la app esté en modo «Testing», añade a los usuarios como testers. Para abrirla al público, Google exige verificar la app porque es un permiso restringido.

### Inicio de sesión con Google (opcional)

Es distinto de Gmail: actívalo en Supabase → Authentication → Providers → Google.

## Tareas programadas (cron)

Ambas rutas usan `Authorization: Bearer <CRON_SECRET>`:

| Ruta | Qué hace | Frecuencia sugerida |
|---|---|---|
| `POST /api/cron/sync` | Sincroniza los calendarios de todos los usuarios | cada 1–3 h |
| `POST /api/cron/notify` | Envía push y emails con lo que vence hoy y mañana | una vez al día (p. ej. 07:30) |

Durante una rotación de secreto puedes definir `CRON_SECRET_PREVIOUS`. Si `CRON_SECRET` no está configurado, las rutas responden `500`.

## Desarrollo

```sh
npm test         # vitest
npx tsc --noEmit # tipos
npm run lint
```
