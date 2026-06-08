# Plan: corregir el IDOR / Broken Access Control (auditoría jun 2026)

> Estado: **Fase 1 COMPLETA y verificada en prod** (jun 2026). Falta la Fase 2
> (migrar funciones). Es la vulnerabilidad más grave de la app.

## ✅ Fase 1 hecha (identidad disponible en Convex)

Better Auth ahora emite un JWT (plugin `jwt`, **RS256**) que Convex valida →
`ctx.auth.getUserIdentity()` funciona. Verificado en prod: `authz:whoami`
devuelve `{authenticated:true, subject:<userId>}`.

Piezas (todas desplegadas; **aditivas**, no cambian comportamiento aún):
- `src/lib/auth.ts`: `jwt({ jwks: { keyPairConfig: { alg: "RS256" } } })`.
- `src/lib/auth-client.ts`: `jwtClient()`.
- `src/components/ConvexClientProvider.tsx`: `ConvexProviderWithAuth` (token vía `/api/auth/token`; usa `getSession()` en effect — `useSession()` rompe el prerender estático).
- `convex/auth.config.ts`: provider `customJwt` con `issuer = SITE_URL`, `jwks = SITE_URL/api/auth/jwks`, `algorithm: "RS256"`, `applicationID = issuer` (el `aud` del JWT = baseURL).
- Tabla `jwks` + casos en `convex/betterAuth.ts` (el adaptador ahora maneja el modelo `jwks`).
- `convex/authz.ts`: `requireUserId(ctx)` + `whoami` (temporal).

**Aprendizajes clave** (gotchas que costaron):
- Convex Custom JWT **NO soporta EdDSA** → firmar en **RS256** (push rechazado con `InvalidAuthConfig` si no).
- `applicationID` es **obligatorio** en el provider `customJwt` y debe igualar el `aud` del JWT (= baseURL de Better Auth).
- El plugin `jwt` necesita una tabla/modelo `jwks`; sin añadirla al adaptador → `Unknown auth model: jwks`.

**Limpieza pendiente**: quitar la query `whoami` y borrar los usuarios de prueba `idor-*@example.com` creados al verificar.

---

## Fase 2 — migrar funciones (PENDIENTE, el arreglo real)

## Problema

Todas las funciones de Convex de **datos de la app** reciben `userId` como
argumento del cliente y **no verifican la identidad** (`ctx.auth` no se usa en
ningún sitio; el `ConvexReactClient` no está autenticado). Como la URL de Convex
(`NEXT_PUBLIC_CONVEX_URL`) es pública, cualquiera puede abrir un cliente y llamar
p. ej. `transactions:getAllTransactions({ userId: "<id ajeno>" })` y **leer,
modificar o borrar los datos financieros de cualquier usuario**.

NO afectado (ya correcto):
- **Adaptador Better Auth** (`convex/betterAuth.ts`): valida `CONVEX_ADAPTER_SECRET` en cada handler.
- **API HTTP pública** (`convex/http.ts`): deriva el `userId` de la API key autenticada (server-side), no del cliente.

## Objetivo

Que el backend **derive el `userId` de la sesión verificada** vía
`ctx.auth.getUserIdentity()`, en vez de fiarse del argumento del cliente.

## Enfoque de integración (Better Auth ↔ Convex)

Convex obtiene la identidad de un JWT (OIDC) que el cliente le pasa. Dos caminos:

- **Opción A (recomendada): plugin JWT/JWKS de Better Auth.**
  1. Añadir el plugin `jwt()` a `src/lib/auth.ts` (expone JWKS en `/api/auth/jwks` y permite emitir un JWT de la sesión).
  2. Crear `convex/auth.config.ts` apuntando al issuer de Better Auth (la URL del sitio) y su JWKS.
  3. En el cliente, usar `ConvexProviderWithAuth` (o `convex.setAuth(fetchToken)`) para entregar el JWT de Better Auth a Convex. Reemplaza el `ConvexProvider` plano de `src/components/ConvexClientProvider.tsx`.
  4. Verificar con una función de prueba que `ctx.auth.getUserIdentity()` devuelve el `subject` = id de usuario de Better Auth, ANTES de tocar nada más.

- **Opción B: componente oficial `@convex-dev/better-auth`.** Más “llave en mano”
  pero implica adoptar su patrón de auth (hoy se usa un adaptador propio en
  `convex/convex-auth-adapter.ts` + `convex/betterAuth.ts`); migrar a él es más invasivo.

> Decisión a tomar al empezar: A vs B. A encaja mejor con el adaptador actual.

## Helper central

```ts
// convex/authz.ts
export async function requireUserId(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");
  return identity.subject; // = id de usuario de Better Auth
}
```

## Migración (por grupos, función + sus llamadas de frontend juntas)

Para cada función pública que hoy recibe `userId`:
1. Quitar `userId` de `args`.
2. Obtenerlo con `requireUserId(ctx)`.
3. En funciones por-recurso (p. ej. `getMessages`, `updateTransactionCategory`,
   `deleteConversation`), verificar que el documento pertenece a ese `userId`
   (ya hay checks de ownership en `assistant.ts`; replicar el patrón).
4. Actualizar los componentes que llamaban con `{ userId }` para que llamen sin él.
   Hoy el frontend obtiene el id con `authClient.getSession()` y lo pasa; pasará a
   apoyarse en el estado de auth de Convex para el gating (`useConvexAuth()` /
   `Authenticated`/`AuthLoading`).

Módulos Convex a migrar (públicos con `userId` de cliente):
`transactions`, `statements`, `subscriptions`, `assistant`, `assistantActions`,
`projections`, `projectionsActions`, `categoryRules`, `insights`,
`insightsActions`, `taxonomyActions`, `apiKeys`, `notifications`, `onboarding`.

> Listar exhaustivo: `grep -rnE "userId: v.string\(\)" convex --include=*.ts | grep -v _generated`
> y revisar uno a uno (algunos internals legítimamente reciben userId desde otra función ya autenticada — esos se quedan).

NO tocar (ya correctos): `convex/http.ts` (API key), `convex/betterAuth.ts`
(secreto), funciones `internal*` llamadas desde otras ya autenticadas.

## Pruebas (antes de dar por cerrado)

- Login email + Google → cada página de `/app` carga y muestra SOLO datos propios.
- Subida de extracto, recategorizar, excluir, proyecciones, asistente, ajustes/API: todo sigue funcionando.
- **Prueba de ataque**: con la sesión del usuario A, intentar leer datos del usuario B → debe fallar (no devolver datos).
- API HTTP pública sigue funcionando con su API key.

## Rollout sin romper

1. Desplegar la integración de auth (pasos 1–4) sin cambiar funciones → la app sigue igual, pero ya hay identidad disponible.
2. Migrar módulo a módulo (backend + frontend juntos), desplegando y probando cada grupo.
3. Solo cuando TODOS los callers estén migrados, quitar `userId` de los `args` públicos.
4. `git add convex/_generated` en cada paso (el build de Netlify no corre codegen).
5. Recordar: cada cambio de backend requiere `npx convex dev --once` (Netlify no despliega Convex).

## Hardening menor relacionado (opcional)
- `checkSecret` en `betterAuth.ts` usa comparación no constante; usar comparación en tiempo constante.
