# Yield

**Entiende tu dinero en 2 minutos.** Yield es un SaaS de finanzas personales: subes tu extracto bancario (PDF, CSV o Excel) y obtienes tus transacciones categorizadas con IA, detección de suscripciones, insights mensuales y proyecciones de ahorro — sin conocimientos financieros.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) · Tailwind CSS v4 · Shadcn/UI |
| Backend | [Convex](https://convex.dev) (base de datos reactiva + actions + HTTP router) |
| Auth | Better Auth (email + Google OAuth) |
| IA | Claude (Anthropic) — extracción de PDFs por visión, categorización e insights |
| Pagos | Stripe (Checkout + Customer Portal + webhooks) |

## Funcionalidades

- **Onboarding**: wizard de subida multi-archivo con preguntas sobre comercios ambiguos y taxonomía de categorías personalizada
- **Categorización inteligente**: reglas aprendidas del usuario primero, Claude para el resto; cada corrección manual crea una regla
- **Dashboard**: KPIs mensuales, ranking de categorías, suscripciones detectadas, calendario de gasto, insights de IA
- **Proyecciones**: simulador interactivo de ahorro a 3/6/12 meses sobre medias reales
- **API pública** (`/v1`): subir extractos e insertar transacciones desde n8n/Zapier/scripts, leer resúmenes e insights — documentada en `/docs/api`
- **Planes**: Free (primera subida + análisis del período, datos en solo lectura) y Pro 7€/mes o 59€/año (subidas ilimitadas, insights por mes, proyecciones, asistente, API)

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Variables de entorno

Crea `.env.local` (nunca se commitea) con:

| Variable | Descripción |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Secreto de sesión de Better Auth |
| `BETTER_AUTH_URL` | URL base de la app (`http://localhost:3000` en dev) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth de Google |
| `CONVEX_ADAPTER_SECRET` | Secreto compartido del adapter de auth |
| `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_CONVEX_SITE_URL` | Deployment de Convex |
| `ANTHROPIC_API_KEY` | API key de Anthropic |

Y en el deployment de Convex (`npx convex env set`):

| Variable | Descripción |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Para las actions de IA |
| `CONVEX_ADAPTER_SECRET` | Igual que en `.env.local` |
| `STRIPE_SECRET_KEY` | Clave de Stripe (restricted recomendada) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret del webhook |
| `SITE_URL` | URL de retorno del Checkout |

### 3. Stripe (una sola vez por entorno)

```bash
# Crear producto "Yield Pro" + precios (7€/mes, 59€/año)
npx convex run stripeActions:setupStripeProducts
# Registrar el webhook en el dashboard de Stripe:
#   https://<deployment>.convex.site/stripe/webhook
#   Eventos: checkout.session.completed, customer.subscription.{created,updated,deleted}
```

### 4. Desarrollo

```bash
npx convex dev    # terminal 1 — backend Convex
npm run dev       # terminal 2 — Next.js en :3000 (usa -- -p 3001 si está ocupado)
```

### Otros comandos

```bash
npm run build     # build de producción + chequeo de TypeScript
npm run lint      # ESLint
```

## API pública

Documentación completa en `/docs/api` (también enlazada desde la landing). Autenticación con claves personales (`Authorization: Bearer yld_...`) que se gestionan en **Ajustes → API**. La API es una función del plan Pro.

## Seguridad

- Los secretos viven en `.env.local` y en las env vars de Convex — nunca en el código
- Las API keys de usuario se guardan **hasheadas** (SHA-256); el plaintext se muestra una sola vez
- El webhook de Stripe verifica la firma de cada evento
- `database.db` (datos locales de auth en dev) está excluida del repositorio
