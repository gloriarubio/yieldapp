# CLAUDE.md

Este fichero se debe ir actualizando cada vez que haya cambios en el proyecto. Has de leer este fichero cada vez que vayas a realizar un cambio o a comenzar a trabajar en algo nuevo. Has de ser consciente de los cambios que han habido y de las convenciones que se deben seguir. Incluye los comandos que debes ejecutar para poner en marcha el proyecto, los comandos que debes ejecutar para compilar el proyecto, los comandos que debes ejecutar para ejecutar los tests, etc. Incluye también cualquier otra información que consideres relevante. Has de leer este fichero cada vez que vayas a realizar un cambio o a comenzar a trabajar en algo nuevo.

## Commands

```bash
npm run dev          # dev server on :3000 (use -- -p 3001 if 3000 is occupied)
npm run build        # production build + TypeScript check
npm run lint         # ESLint
```

Port 3000 is often occupied by another local project — use `npm run dev -- -p 3001` in that case.

## Architecture

**Yield** is a financial SaaS landing page (Next.js 16 App Router). The full product — dashboard, file upload, AI assistant — is planned but not yet built. Today only the marketing landing page exists.

### Stack
- **Next.js 16 App Router** — single route `/` in `src/app/`
- **Tailwind CSS v4** — CSS-first config inside `globals.css` via `@theme inline`; there is no `tailwind.config.ts`
- **Shadcn/UI** — components in `src/components/ui/`, `cn()` utility in `src/lib/utils.ts`
- **Lucide React** — icons used throughout landing components

### Fonts
Loaded via `next/font` in `layout.tsx`, exposed as CSS variables:
- `--font-playfair` → Playfair Display (serif + italic) — all display headings
- `--font-dm-sans` → DM Sans — body text (replaces Inter)
- `--font-dm-mono` → DM Mono — monospace / tokens

Apply the display font with inline `style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}` on elements directly; Tailwind v4's `font-display` utility requires explicit `@theme` wiring that isn't set up yet.
DM Sans is wired to `--font-sans` in the `@theme inline` block so Tailwind's `font-sans` class resolves to it automatically.

### Design tokens
**El tema actual es CLARO (crema/verde), no oscuro.** Definido en `src/app/globals.css` (`/* YIELD DESIGN TOKENS — LIGHT ONLY */`). En componentes usar SIEMPRE las variables CSS (`var(--bg)`, `var(--accent)`...), nunca hardcodear hex de ninguna paleta.

| Variable | Valor | Rol |
|----------|-------|-----|
| `--bg` / `--bg2` | `#F4EFE5` / `#EBE4D8` | Fondo de página / fondo alterno |
| `--card` / `--card2` | `#FEFAF3` / `#F0E9DE` | Superficies de tarjeta |
| `--border` / `--border2` | `rgba(10,10,10,0.07)` / `0.13` | Bordes sutil / énfasis |
| `--text` | `#0C0C0C` | Texto principal |
| `--text2` / `--text3` | `#5A524A` / `#7A6F66` | Texto secundario / muted |
| `--accent` / `--accent2` | `#1E3D2C` / `#2A5040` | Verde oscuro — CTAs, énfasis (texto de botón sobre accent: `#fff`) |
| `--green` / `--green-dim` | `#1A6E3C` / rgba 0.08 | Positivos, badges |
| `--red` / `--red-dim` | `#A83030` / rgba 0.08 | Negativos, destructivo |

Sobre fondos oscuros puntuales (p. ej. bloques de código `#111111` en `/docs/api`) el texto va en blanco `#fff`.

Custom animation classes defined in `globals.css`:
- `animate-marquee` — infinite ticker scroll
- `animate-fade-up` — entry fade (hero text)
- `animate-dash-entry` — 3D perspective entry (dashboard mockup)
- `animate-drift` — ambient blob floating
- `animate-bar-grow` — bar chart scale-up (transform-origin: bottom)
- `sr` / `sr-visible` — scroll reveal system (IntersectionObserver via `<Reveal>` component in `src/components/ui/reveal.tsx`)
- `sr-delay-1..6` — staggered reveal delays

The grain texture is applied via `body::before` in globals.css (fixed, pointer-events-none, z-index 9998).

### Landing page structure
`src/app/page.tsx` composes all sections in order:

```
Navbar → Hero → Ticker → HowItWorks → Stats → Features → Pricing → Faq → CtaSection → Footer
```

Every section is a named export from `src/components/landing/<Name>.tsx`. `AppMockup.tsx` is a static JSX replica of the dashboard (fake data, purely visual) used inside `Hero.tsx`.

### Onboarding y sistema de aprendizaje de categorías (jun 2026)

Flujo completo de onboarding + reglas de usuario + aprendizaje continuo:

- **`/onboarding`** — wizard de 4 pasos (subida multi-archivo → procesamiento → preguntas sobre comercios ambiguos → resumen con renombre de categorías). Componentes en `src/components/onboarding/` (`OnboardingWizard`, `MerchantQuestion`, `CategorySummary`). Estado del wizard en `useState` local; solo se persiste al finalizar con `saveOnboardingRules`.
- **`src/lib/categorization.ts`** — lógica pura testeable: `normalizeMerchant` (mayúsculas, corta sufijos tras `*`/`#`/`/`/espacio+dígitos), `applyUserRules` (matching por `includes` sobre descripción normalizada), `getAmbiguousMerchants` (grupos low-confidence >1% del gasto y >1 transacción, máx 10).
- **`src/lib/categorization-ai.ts`** — `categorizeWithAI` (Claude, lotes de 100 en onboarding). Separado porque el SDK de Anthropic NO puede importarse desde ficheros Convex de runtime por defecto (ver Errors).
- **Convex**: tabla `category_rules` (userId string + merchantPattern + category + isSubscription + source onboarding/user_edit), tabla `notifications` (type "new_merchants"), campos `transactions.merchantPattern`/`categorySource` ("rule"/"ai"/"manual") y `user.onboardingCompleted`. Mutations en `convex/categoryRules.ts` (`saveOnboardingRules` también sincroniza `userTaxonomy` y aplica renombres; `updateTransactionCategory` crea regla `user_edit` al corregir). Action `convex/onboarding.ts:processOnboardingStatement` procesa cada archivo del wizard.
- **Upload mensual** (`convex/process.ts`): extrae → aplica reglas del usuario → `categorizeWithAI` solo para lo sin regla (con la taxonomía activa del usuario) → guarda con `merchantPattern`/`categorySource` → si hay grupos ambiguos nuevos crea notificación "new_merchants" → banner en el dashboard (`NewMerchantsBanner`) que enlaza a `/app/clasificar` (mini paso 3 del wizard).
- **Guard**: `OnboardingGuard` en `src/app/app/layout.tsx` redirige a `/onboarding` a usuarios autenticados con `onboardingCompleted !== true` (no hay middleware de Next; la auth se comprueba client-side con `authClient.getSession()`, siguiendo el patrón existente). OJO: usuarios existentes sin el campo serán redirigidos al wizard.
- **Recategorización y exclusión** (`/app/transacciones`): clic en la categoría → dropdown para corregirla. `updateTransactionCategory` actualiza esa transacción + todas las del mismo comercio (salvo correcciones manuales previas) + crea regla `user_edit` → los próximos uploads ya vienen bien categorizados. Botón ojo por fila para excluir/incluir del análisis (`transactions.excluded`); las excluidas se ven grises/tachadas y no cuentan en dashboard, totales ni insights.
- **categorizeWithAI deduplica por comercio**: agrupa por `normalizeMerchant` y Claude categoriza COMERCIOS únicos (con frecuencia + importes de muestra), no transacciones — ~5x más rápido y mejor señal para suscripciones. Lotes de 50 comercios en paralelo (concurrencia 4).
- **Criterios de preguntas** (`getAmbiguousMerchants`): low-confidence >1% y >1 transacción (spec), O comercio recurrente (4+ cargos y >2% del gasto, aunque Claude esté seguro), O candidato a suscripción >1%. Máx 10, ordenadas por gasto.
- **Onboarding paso 3 rediseñado (jun 2026)**: dos bloques — A) `detectSpecialMovements` (transferencias/Bizum/traspasos recurrentes o >3% del gasto, máx 4; opciones Ahorro/Vivienda/Transferencias, badge "↔ Transferencia detectada"; sus patterns se excluyen del bloque B) y B) comercios dudosos. Cada pregunta (`MerchantQuestion`) muestra las transacciones reales expandibles (hasta 8), pills sugeridas (Claude devuelve `alternatives` en verdicts low-confidence), selector "Otra categoría…" con todas, "➕ Crear categoría nueva" y "🚫 No contabilizar". La exclusión crea una regla `excludeFromAnalysis` en `category_rules` → los uploads futuros insertan esas transacciones con `excluded: true` automáticamente (aplicado en `process.ts` y `onboarding.ts`). La taxonomía se sincroniza con TODAS las categorías en uso (no solo las respondidas) — bug original: el dropdown de recategorizar solo mostraba las seeds; backfill: `npx convex run categoryRules:backfillTaxonomyFromTransactions`.
- **Insights por mes** (`monthlyInsights` + `insightsActions.generateMonthInsights`): se generan bajo demanda desde el dashboard para el mes seleccionado; un extracto puede abarcar varios meses, así que nunca se guardan en el statement.
- Desviaciones del spec original marcadas con comentarios `TODO(spec)` en el código (ids string de Better Auth en vez de `v.id("users")`, modelo `claude-sonnet-4-6`, visión nativa de Claude en vez de LlamaParse, taxonomía dinámica en vez de lista fija de categorías).

### API pública HTTP (jun 2026)

API REST para integraciones externas (n8n, Zapier, scripts), servida por Convex HTTP actions en `https://<deployment>.convex.site` (la URL de `NEXT_PUBLIC_CONVEX_URL` cambiando `.convex.cloud` → `.convex.site`).

- **Auth**: API keys personales (`Authorization: Bearer yld_...`). Tabla `api_keys` (solo se guarda el SHA-256; el plaintext se muestra UNA vez al crearla). Gestión en `/app/ajustes` (`convex/apiKeys.ts`: la creación es una **action** porque las mutations deben ser deterministas y la key usa `crypto.getRandomValues`). Helpers de hash/generación compartidos en `convex/apiKeyUtils.ts` (Web Crypto, runtime por defecto — sin `"use node"`).
- **Endpoints** (`convex/http.ts`):
  - `POST /v1/statements` — subir extracto (multipart campo `file`, o JSON `{filename, data}` base64). Devuelve `202 {id, status}`; el procesamiento es async → poll `GET /v1/statements/{id}`.
  - `GET /v1/statements` y `GET /v1/statements/{id}` (estado + `progress`; con check de ownership).
  - `POST /v1/transactions` — transacciones JSON `{transactions: [{date, description, amount, merchant?}], source?}` (máx 1000). Crea un statement `fileType: "api"` (sin `storageId`, ahora opcional en el schema) y pasa por el MISMO pipeline de reglas + IA (`processApiTransactions`).
  - `GET /v1/transactions` — filtros `month`/`from`–`to`/`category`/`type`/`includeExcluded`, paginación por cursor (`convex/apiQueries.ts`; los filtros category/type se aplican por página: seguir el cursor hasta `isDone`, no contar items).
  - `GET /v1/summary?month=YYYY-MM` — ingresos/gastos/neto, desglose por categoría, top comercios, suscripciones (excluye `excluded`).
  - `GET /v1/insights?month=YYYY-MM[&generate=true]` — insights del mes, generación bajo demanda.
  - `GET /v1/categories` — taxonomía activa (seeds si aún no hay).
- **Pipeline reutilizable**: la fase común de categorización+guardado de `processStatement` está extraída en el helper `categorizeAndFinalize` (`convex/process.ts`); `processStatement` acepta `statementId` opcional (el http action crea el statement antes para devolver el id en el 202 y luego programa la action con `ctx.scheduler.runAfter`).
- **UI**: `/app/ajustes` tiene pestañas — "API" (gestión de claves + banner a la documentación) y "Notificaciones" (placeholder). La documentación pública vive en `/docs/api` (`src/app/docs/api/page.tsx`, server component estático con estilo de la landing) y está enlazada desde la pestaña API y desde la columna "Recursos" del Footer de la landing.

### Proyecciones — planificador de ahorro (jun 2026)

`/app/proyecciones` (Pro) pasó de simulador de sliders a planificador completo:

- **Tabla `projection_plans`** (1 doc/usuario, autosave con debounce 700ms): meta (nombre+importe+fecha opcional), `categoryCuts` (recorte €/mes por categoría), `cancelledSubscriptions` (nombres), `aiVerdict` cacheado. CRUD en `convex/projections.ts`.
- **Stats puras** en `src/lib/projections.ts` (compartidas por la página y la action de IA): **medianas** con rango p25-p75 (nunca medias), tendencia (últimos 3 meses vs anteriores, ±15%), suscripciones activas (cargo en los últimos 45 días del dataset), top comercio por categoría (si ≥25% del total), `monthsToTarget`/`addMonths`.
- **UI**: tarjeta de meta con ETA a ritmo actual vs con plan; gráfica SVG de trayectoria (línea punteada=actual, sólida=simulada, línea de meta); toggles de suscripciones ("palanca rápida"); sliders por categoría (máx=mediana redondeada, step 1 — regla del slider bug) con badge de tendencia y hint del comercio dominante; los sliders EXCLUYEN "Suscripciones" para no contar dos veces el mismo euro.
- **Veredicto IA** (`convex/projectionsActions.ts`, `"use node"`): Claude evalúa la viabilidad del plan (recortes >40% del típico = irreales, palancas sin usar, llegada a la meta) y se guarda en el plan. El cliente hace flush del autosave antes de evaluar.
- Patrón de estado: ediciones locales en `useState` como capa sobre el plan guardado (`local ?? saved ?? 0`) — evita el lint de setState-en-effect al hidratar.

### Stripe — suscripciones (jun 2026)

Planes: **Free** (única subida inicial completa; después datos en solo lectura) y **Pro** 7€/mes o 59€/año (subidas recurrentes + creación de claves de API).

- **Tablas**: `subscriptions` (1 fila por usuario: stripeCustomerId, plan, interval, status, cancelAtPeriodEnd, currentPeriodEnd). Sin fila o status no activo = Free. Helper puro `subscriptionIsPro` en `convex/subscriptionHelpers.ts` (fichero SIN registros de funciones para poder importarse desde `"use node"`).
- **`convex/stripeActions.ts`** (`"use node"`): `createCheckoutSession` (resuelve precios por lookup keys `yield_pro_month`/`yield_pro_year`, NUNCA pasa `payment_method_types`), `createPortalSession`, `processStripeWebhook` (verifica firma con el SDK), `setupStripeProducts` (idempotente, crea producto+precios; ejecutar con `npx convex run stripeActions:setupStripeProducts`).
- **Webhook**: `POST /stripe/webhook` en `convex/http.ts` → pasa raw body + firma a la action node. Eventos: `checkout.session.completed`, `customer.subscription.created/updated/deleted`. URL a registrar en Stripe: `https://<deployment>.convex.site/stripe/webhook`.
- **Env vars de Convex** (`npx convex env set`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (URLs de retorno del Checkout).
- **Gates Free**: `checkCanUpload` (subidas solo hasta `onboardingCompleted`; después requiere Pro) aplicado en `processStatement` (web) y en los POST de la API. **La API entera es Pro**: `authenticate()` en `http.ts` comprueba el plan en cada petición y responde `402 pro_required` si no hay Pro activo — las claves NO se borran al hacer downgrade, quedan en pausa y reviven al reactivar (evita el abuso "alta → crear clave → baja → seguir usando la API"). `createApiKey` también requiere Pro. **Pro-only en UI**: `/app/proyecciones` (tarjeta candado) y el asistente del `AiPanel` (bloqueado con CTA). **Insights**: Pro = por mes (`generateMonthInsights`); Free = un análisis global de todo el período (`generatePeriodInsights`, guardado en `monthlyInsights` con `month: "all"` — el dashboard cambia el ámbito de la tarjeta según el plan). Todos los candados leen `api.subscriptions.getSubscription` — al pagar, la reactividad de Convex los abre sin recargar.
- **UI**: pestaña "Suscripción" en `/app/ajustes` (upgrade → Checkout, "Gestionar suscripción" → Customer Portal, banners `?checkout=success|cancelled`); badge del Sidebar lee el plan real; CTAs del Pricing de la landing enlazan a `/app/ajustes?tab=suscripcion`; página de extractos muestra tarjeta de upgrade en vez de dropzone si Free post-onboarding.

### Asistente IA conversacional (jun 2026)

Chat (Pro) que responde preguntas libres sobre las finanzas del usuario, con **conversaciones persistentes** en una página propia.

- **Persistencia**: tablas `assistant_conversations` (1 por conversación: `title`/`createdAt`/`updatedAt`) y `assistant_messages` (`conversationId`/`userId`/`role`/`text`). CRUD en `convex/assistant.ts` (V8, sin SDK): `listConversations` (orden updatedAt desc), `getMessages` (con check de ownership), `createConversation`, `addUserMessage` (deriva el título del primer mensaje), `deleteConversation`, + internals (`getConversationInternal`/`getMessagesInternal`/`addAssistantMessage`) usados por la action.
- **`convex/assistantActions.ts:ask`** (`"use node"`, args `userId`/`conversationId`): comprueba Pro (`getSubscriptionInternal` + `subscriptionIsPro`), valida ownership, **lee el historial de la BD** (últimos 12 turnos, recorta mensajes `assistant` iniciales — la API de Anthropic exige empezar por `user`), construye un **resumen agregado compacto** con `buildContext` (NUNCA transacciones en crudo): `porMes` (ingresos/gastos/ahorro, 24 meses), `categoriasPorMes` (matriz categoría×mes para tendencias), `topGastosUnicos` (10 mayores), `topComercios` (por `merchantPattern`), `totalSuscripciones`. Modelo `claude-sonnet-4-6`, `max_tokens: 700`, resumen en `system`. Persiste la respuesta con `addAssistantMessage`.
- **Flujo cliente** (`/app/asistente`, `src/app/app/asistente/page.tsx`): lista de conversaciones + chat. En cada envío: `createConversation` si no hay activa → `addUserMessage` (la query reactiva muestra el mensaje) → `ask` (persiste la respuesta). Los mensajes salen de `useQuery(getMessages)` (fuente única de verdad, reactiva); `sending` controla el indicador de typing. Lee `?c=<id>` y `?q=<texto>` de la URL como estado inicial. Pro-gated (tarjeta "Activar Pro" si Free). Item "Asistente" en el `Sidebar`.
- **`AiPanel`** (columna derecha 280px, en todas las páginas de `/app`): ya NO es un chat — es un **acceso rápido** (sugerencias que enlazan a `?q=…`, conversaciones recientes a `?c=…`, botón "Abrir asistente"). Sigue bloqueado para Free.

### Despliegue (Netlify) y SEO/iconos (jun 2026)

- **Producción**: `https://yieldapp-goals.netlify.app` (Netlify, project `yieldapp-goals`, runtime Next vía `@netlify/plugin-nextjs`). El repo de GitHub es **público** — fue necesario: en plan **Free** + repo privado, Netlify bloquea TODOS los deploys con *"Build blocked: unrecognized Git contributor"* (verificación estricta de contribuidor), y producción se quedó congelada 5 commits. Hacerlo público quita la restricción y restaura los deploys automáticos por push. **No se puede compilar el plugin de Next en local en Windows** (`netlify deploy --build` falla con `EPERM: operation not permitted, symlink` al crear los symlinks de node_modules) — depender siempre del build de Netlify (Linux) o activar el Modo de desarrollador de Windows.
- **Env vars de Netlify** (`netlify env:set ...`, contexto `all`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (DEBE igualar la URL de producción exacta — apuntaba al nombre viejo `yieldapp-275` y rompía la auth), `CONVEX_ADAPTER_SECRET`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `GOOGLE_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`, `LLAMAPARSE_API_KEY`. Opcional `NEXT_PUBLIC_SITE_URL` (lo lee `metadataBase` y `auth.ts` con prioridad).
- **⚠️ Renombrar el sitio de Netlify rompe 3 sitios que dependen de la URL** (el nombre viejo era `yieldapp-275`, el actual `yieldapp-goals`). Al cambiar el nombre/dominio hay que actualizar TODOS: (1) `BETTER_AUTH_URL` en Netlify; (2) la **Authorized redirect URI** del cliente OAuth de Google en `console.cloud.google.com/apis/credentials` → `<URL>/api/auth/callback/google` (si no, login con Google da `Error 400: redirect_uri_mismatch`); (3) `SITE_URL` en Convex (`npx convex env set SITE_URL <URL>`) — son las URLs de retorno del Checkout de Stripe; si apunta al sitio viejo, al volver del pago sale el "Site not found" de Netlify. El webhook de Stripe usa el dominio de Convex (`*.convex.site`), que NO cambia al renombrar Netlify.
- **Iconos y meta tags** (convención de fichero de Next App Router en `src/app/`): `icon.svg` (favicon vectorial), `favicon.ico` (16/32/48), `apple-icon.png` (180), `opengraph-image.png` + `twitter-image.png` (1200×630). Todos generados de la marca Yield (curva + punto arena `#C8B49A` sobre cuadrado verde `#1E3D2C`) con `sharp` — el `.ico` se construye a mano (PNG-in-ICO) porque sharp no escribe `.ico`. Metadata (OG + Twitter Card + `themeColor` + `metadataBase`) en `layout.tsx`; las imágenes de compartir se referencian solas por convención de fichero, no hace falta declararlas.

### Seguridad (auditoría jun 2026)

- **Corregido**: `admin:clearAllData` pasó de `mutation` pública (cualquiera podía vaciar la BD) a `internalMutation`; cabeceras de seguridad base en `netlify.toml` (X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy — SIN CSP aún por los estilos/scripts inline); `xlsx@0.18.5` (prototype pollution + ReDoS, sin fix en npm) sustituido por SheetJS 0.20.3 del CDN oficial (misma API).
- **PENDIENTE (crítico)**: IDOR — las funciones Convex de datos se fían del `userId` del cliente sin verificar identidad (`ctx.auth` no se usa; cliente Convex no autenticado). Plan detallado en **`SECURITY-IDOR-PLAN.md`**. El adaptador Better Auth (`betterAuth.ts`, valida `CONVEX_ADAPTER_SECRET`) y la API HTTP (`http.ts`, API key) NO están afectados.
- ⚠️ **Nunca** "verificar" una función destructiva ejecutándola: `npx convex run <fn>` ejecuta también funciones **internas** desde el CLI. Comprobar el tipo leyendo el código / el API público, jamás invocándola.

### Key conventions
- UI text in Spanish; code, variables, and comments in English
- `"use client"` only on components that use hooks or browser APIs (Navbar, Faq, AppMockup, YieldLogo)
- Colours are always referenced as inline Tailwind literals (`bg-[#c8b49a]`), not CSS variable names in class strings
- Path alias: `@/*` → `src/*`

### Errors
Haz un inventario de los errores más comunes o más importantes para que no se vuelvan a repetir.

- **Fechas de banco sin normalizar rompen TODA la app**: cada banco exporta las fechas a su manera ("02/05/2025", seriales de Excel, años de 2 dígitos) y el parser de CSV/Excel las guardaba tal cual — el selector de mes mostraba "NaN", los filtros por mes y las queries por rango del índice `by_userId_and_date` fallaban en silencio. Regla: TODA fecha que entre al sistema pasa por `normalizeDate` (`src/lib/dates.ts`, día-primero estilo español) y se descarta la fila si no se puede parsear; el dashboard además filtra meses que no cumplan `^\d{4}-\d{2}$`. Migración para datos viejos: `npx convex run transactions:fixMalformedDates`.
- **Hardcodear colores de una paleta antigua**: la app migró de tema oscuro a claro y este fichero tenía la tabla vieja — al crear `/docs/api` y los botones de ajustes se usaron hex del tema oscuro (`#0b0b0b` como texto de botón, `var(--text)` sobre fondo negro) y quedaron ilegibles. Regla: usar siempre `var(--*)` de `globals.css`; si un elemento tiene fondo oscuro fijo (bloques de código), su texto va `#fff` explícito.

- **SDK de Anthropic en Convex runtime por defecto**: cualquier fichero `convex/*.ts` sin `"use node"` que importe (directa o transitivamente) `@anthropic-ai/sdk` rompe `npx convex codegen` con errores `Could not resolve "node:fs"`. Las llamadas a Claude van en ficheros `"use node"` (actions) y la lógica pura compartida en módulos sin dependencias de SDK (`src/lib/categorization.ts` vs `categorization-ai.ts`).
- **`react-hooks/set-state-in-effect`**: el ESLint del proyecto marca error al hacer `setState` síncrono dentro de `useEffect`. Para preseleccionar valores derivados de queries, derivarlos en render (función `answerFor`-style) en vez de un effect.
- **Validators estrictos de Convex**: `insertTransactions` rechaza campos extra — quitar campos auxiliares (p. ej. `isSubscription` de las reglas) antes de insertar.
- **`max_tokens` insuficiente trunca el JSON y TODO el lote cae a "Otros"**: con lotes de 100 transacciones y `max_tokens: 2000`, la respuesta JSON se truncaba, `JSON.parse` fallaba y el catch degradaba el lote entero a "Otros"/low (parecía que la IA "no conocía" Zara, Repsol, Sorli...). Regla: lotes de ≤50 con `max_tokens: 8000`, comprobar `stop_reason === "max_tokens"` y lanzar para que actúe el fallback. Los lotes corren en paralelo (concurrencia 4) — en secuencia el onboarding tardaba 4-5 min.
- **Progreso de actions largas**: el cliente no ve nada hasta que la action termina. Patrón: la action patchea un campo `progress` en el documento (statements) y el cliente se suscribe con `useQuery` — la reactividad de Convex hace el resto.
- **Barras/sliders que no llegan al final** (ha pasado 2 veces): en `<input type="range">`, si `max` no es múltiplo de `step` (p. ej. max=487 con step=5), el tirador nunca alcanza el máximo y la barra queda incompleta. Regla: usar `step={1}` o redondear `max` al múltiplo del step. Lo mismo aplica a barras de progreso calculadas con porcentajes redondeados.
- **Dev server con chunks viejos**: si la UI muestra algo "imposible" según el código (p. ej. hijos de un mismo grid con alturas distintas), sospechar del dev server antes que del CSS — tras muchas horas de HMR, y sobre todo si se ejecuta `npm run build` mientras `next dev` corre sobre el mismo `.next`, el navegador puede servir chunks mezclados. Solución: reiniciar el dev server + Ctrl+F5. Diagnóstico rápido: medir alturas reales en la consola con `getBoundingClientRect()`.
- **Columnas de grid que cambian de ancho según el contenido**: `1fr` equivale a `minmax(auto, 1fr)` — un texto largo sin posibilidad de truncarse (nombre de comercio, URL) ensancha su columna y encoge la vecina, y el efecto varía por mes según los datos. Regla: en grids de tarjetas usar SIEMPRE `minmax(0, 1fr)` y poner `minWidth: 0` en la raíz de la tarjeta para que los textos con `ellipsis` puedan truncar.
- **El build de Netlify NO despliega Convex** (el más peligroso): el comando de build es solo `next build`. Las funciones y el esquema de Convex viven en el deployment `rapid-ermine-684` (`NEXT_PUBLIC_CONVEX_URL`) y se despliegan APARTE — `npx convex codegen` SOLO genera tipos locales, NO sube nada. Síntoma de olvidarlo: el frontend llama a `api.x.y`, Convex responde *"Could not find function for 'x:y'"*, `useQuery` lanza y, como no hay error boundary, **tumba la página entera** (y si la query rota está en un componente global como el `AiPanel`, falla CADA recarga de CUALQUIER página con "This page couldn't load"). Regla: tras tocar cualquier `convex/*.ts` (función o `schema.ts`), ejecutar **`npx convex dev --once`** para desplegar al backend; verificar con `npx convex run <file>:<fn> '{...}'`. (Pendiente futuro: mover a un deployment de prod y meter `npx convex deploy --cmd 'npm run build'` en el build de Netlify con `CONVEX_DEPLOY_KEY`.)
- **Olvidar commitear `convex/_generated/api.d.ts` al añadir una función Convex**: `convex/_generated/` está TRACKEADO en git, y el build de Netlify es solo `next build` (no corre codegen). Al crear una nueva action/query (p. ej. `assistantActions.ask`), `npx convex codegen` regenera `api.d.ts` en local pero hay que **commitearlo**; si no, en Netlify el tipo no existe, `api.x.y` no type-chequea y el build cae con **exit 2** (en local pasa porque el fichero regenerado está en disco aunque sin commitear). Regla: tras tocar funciones Convex, `git add convex/_generated`.
- **403 al registrarse con email en producción (Better Auth)**: el registro/login con email devolvía `403` (Google funcionaba porque va por redirect OAuth, no por la comprobación de origen). Dos causas combinadas: (1) `auth.ts` no declaraba `trustedOrigins` → Better Auth rechaza el origen por CSRF; (2) `BETTER_AUTH_URL` en Netlify apuntaba al nombre de sitio viejo. Regla: `auth.ts` declara `trustedOrigins` (producción + localhost + `https://*.netlify.app` para previews) y `baseURL` resuelto de `BETTER_AUTH_URL`/`NEXT_PUBLIC_SITE_URL`; y `BETTER_AUTH_URL` SIEMPRE debe igualar la URL de producción. Diagnóstico: si el origen ya está permitido, el endpoint pasa de `403` a `400` (validación). Ver la sección Despliegue.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
