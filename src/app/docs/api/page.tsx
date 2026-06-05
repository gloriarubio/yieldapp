import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentación de la API — Yield",
  description:
    "Referencia de la API REST de Yield: sube extractos, inserta transacciones y consulta tus finanzas desde n8n, Zapier o tus propios scripts.",
};

// Base URL of the public HTTP API: the .convex.cloud client URL maps to
// .convex.site for HTTP actions
const API_BASE =
  (process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://<deployment>.convex.cloud").replace(
    ".convex.cloud",
    ".convex.site"
  );

const MONO = "var(--font-dm-mono), monospace";
const SERIF = "var(--font-playfair), Georgia, serif";

// ─── Building blocks ─────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.5px",
        color: method === "POST" ? "var(--accent)" : "var(--green)",
        background: method === "POST" ? "rgba(30,61,44,0.08)" : "rgba(26,110,60,0.09)",
        border: `1px solid ${method === "POST" ? "rgba(30,61,44,0.25)" : "rgba(26,110,60,0.25)"}`,
        borderRadius: 6,
        padding: "3px 8px",
        flexShrink: 0,
      }}
    >
      {method}
    </span>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontFamily: MONO,
        fontSize: 12,
        lineHeight: 1.7,
        color: "#fff",
        background: "#111111",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 16px",
        overflowX: "auto",
        margin: "12px 0 0",
        whiteSpace: "pre",
      }}
    >
      {children}
    </pre>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: MONO,
        fontSize: "0.92em",
        color: "var(--accent)",
        background: "var(--card2)",
        border: "1px solid var(--border)",
        borderRadius: 5,
        padding: "1px 5px",
      }}
    >
      {children}
    </code>
  );
}

function ParamTable({
  params,
}: {
  params: Array<{ name: string; type: string; desc: string }>;
}) {
  return (
    <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      {params.map((p, i) => (
        <div
          key={p.name}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,0.9fr) 90px minmax(0,1.8fr)",
            gap: 12,
            padding: "9px 14px",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
            fontSize: 12.5,
            alignItems: "baseline",
            minWidth: 0,
          }}
        >
          <code style={{ fontFamily: MONO, fontSize: 12, color: "var(--text)" }}>{p.name}</code>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text2)" }}>{p.type}</span>
          <span style={{ color: "var(--text2)", lineHeight: 1.55 }}>{p.desc}</span>
        </div>
      ))}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 90, paddingTop: 8 }}>
      <h2
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          fontWeight: 500,
          color: "var(--text)",
          margin: "40px 0 0",
          letterSpacing: "-0.3px",
        }}
      >
        {title}
      </h2>
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

function Endpoint({
  id,
  method,
  path,
  children,
}: {
  id: string;
  method: "GET" | "POST";
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        scrollMarginTop: 90,
        background: "var(--card, #161616)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "22px 24px",
        marginTop: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <MethodBadge method={method} />
        <code style={{ fontFamily: MONO, fontSize: 14, color: "var(--text)" }}>{path}</code>
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

const pStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.7,
  color: "var(--text2)",
  margin: "8px 0 0",
};

const subheadStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  color: "var(--text3)",
  margin: "18px 0 0",
};

// ─── Table of contents ───────────────────────────────────────────────────────

const TOC: Array<{ id: string; label: string; indent?: boolean }> = [
  { id: "introduccion", label: "Introducción" },
  { id: "autenticacion", label: "Autenticación" },
  { id: "subir-extractos", label: "Subir extractos" },
  { id: "post-statements", label: "POST /v1/statements", indent: true },
  { id: "get-statement", label: "GET /v1/statements/{id}", indent: true },
  { id: "get-statements", label: "GET /v1/statements", indent: true },
  { id: "transacciones", label: "Transacciones" },
  { id: "post-transactions", label: "POST /v1/transactions", indent: true },
  { id: "get-transactions", label: "GET /v1/transactions", indent: true },
  { id: "analisis", label: "Análisis" },
  { id: "get-summary", label: "GET /v1/summary", indent: true },
  { id: "get-insights", label: "GET /v1/insights", indent: true },
  { id: "get-categories", label: "GET /v1/categories", indent: true },
  { id: "errores", label: "Errores" },
  { id: "n8n", label: "Integración con n8n" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top nav */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(244,239,229,0.85)", // --bg with alpha for the blur
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "16px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 600,
              fontSize: 16,
              color: "var(--text)",
              textDecoration: "none",
              letterSpacing: "-0.2px",
            }}
          >
            <svg width="26" height="19" viewBox="0 0 30 22" fill="none">
              <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor" />
            </svg>
            Yield
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 400,
                color: "var(--text2)",
                border: "1px solid var(--border2)",
                borderRadius: 100,
                padding: "2px 10px",
                marginLeft: 4,
              }}
            >
              API · v1
            </span>
          </Link>
          <Link
            href="/app/ajustes"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: "var(--accent)",
              borderRadius: 9,
              padding: "8px 16px",
              textDecoration: "none",
            }}
          >
            Mis claves de API
          </Link>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "48px 32px 90px",
          display: "grid",
          gridTemplateColumns: "210px minmax(0, 1fr)",
          gap: 56,
          alignItems: "start",
        }}
      >
        {/* TOC */}
        <nav
          style={{
            position: "sticky",
            top: 90,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            fontSize: 12.5,
          }}
        >
          <span style={{ ...subheadStyle, margin: "0 0 10px" }}>Contenido</span>
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{
                color: item.indent ? "var(--text2)" : "var(--text)",
                fontFamily: item.indent ? MONO : "inherit",
                fontSize: item.indent ? 11.5 : 12.5,
                fontWeight: item.indent ? 400 : 500,
                textDecoration: "none",
                padding: `4px 0 4px ${item.indent ? 14 : 0}px`,
                lineHeight: 1.4,
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Content */}
        <main style={{ minWidth: 0 }}>
          {/* Hero */}
          <p style={{ ...subheadStyle, margin: 0 }}>Documentación</p>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 44,
              fontWeight: 500,
              color: "var(--text)",
              margin: "10px 0 0",
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            La API de <em style={{ color: "var(--accent)" }}>Yield</em>
          </h1>
          <p style={{ ...pStyle, fontSize: 15, maxWidth: 560, marginTop: 14 }}>
            Conecta Yield con n8n, Zapier o tus propios scripts: sube extractos
            bancarios, inserta transacciones y consulta resúmenes, insights y
            categorías de forma programática.
          </p>

          <Section id="introduccion" title="Introducción">
            <p style={pStyle}>
              Todas las peticiones se hacen sobre HTTPS contra la URL base y
              devuelven JSON (<InlineCode>UTF-8</InlineCode>). Los endpoints de
              escritura son asíncronos: responden{" "}
              <InlineCode>202 Accepted</InlineCode> de inmediato y el
              procesamiento (extracción + categorización con IA) continúa en
              segundo plano.
            </p>
            <p style={subheadStyle}>URL base</p>
            <CodeBlock>{API_BASE}</CodeBlock>
          </Section>

          <Section id="autenticacion" title="Autenticación">
            <p style={pStyle}>
              Crea una clave personal en{" "}
              <Link href="/app/ajustes" style={{ color: "var(--accent)" }}>
                Ajustes → API
              </Link>{" "}
              y envíala en cada petición con la cabecera{" "}
              <InlineCode>Authorization</InlineCode>. La clave se muestra una
              única vez al crearla; guárdala en un gestor de secretos. Puedes
              revocarla en cualquier momento desde la misma pantalla.
            </p>
            <CodeBlock>{`curl ${API_BASE}/v1/summary?month=2026-05 \\
  -H "Authorization: Bearer yld_TU_CLAVE"`}</CodeBlock>
            <p style={pStyle}>
              Sin clave válida cualquier endpoint responde{" "}
              <InlineCode>401</InlineCode> con{" "}
              <InlineCode>missing_api_key</InlineCode> o{" "}
              <InlineCode>invalid_api_key</InlineCode>. La API es una función
              del plan <strong style={{ color: "var(--text)" }}>Pro</strong>: si
              la suscripción no está activa, todas las peticiones responden{" "}
              <InlineCode>402 pro_required</InlineCode> — las claves no se
              borran, se reactivan al volver a Pro.
            </p>
          </Section>

          <Section id="subir-extractos" title="Subir extractos">
            <p style={pStyle}>
              El flujo recomendado: subes el archivo, recibes un{" "}
              <InlineCode>id</InlineCode> y haces polling del estado hasta que
              sea <InlineCode>done</InlineCode>. El extracto pasa por el mismo
              pipeline que una subida manual: extracción, reglas aprendidas del
              usuario y categorización con IA.
            </p>

            <Endpoint id="post-statements" method="POST" path="/v1/statements">
              <p style={pStyle}>
                Sube un extracto bancario en PDF, CSV o Excel. Acepta{" "}
                <InlineCode>multipart/form-data</InlineCode> con el campo{" "}
                <InlineCode>file</InlineCode> (lo que envía n8n por defecto) o
                JSON con el contenido en base64.
              </p>
              <p style={subheadStyle}>Ejemplo (multipart)</p>
              <CodeBlock>{`curl -X POST ${API_BASE}/v1/statements \\
  -H "Authorization: Bearer yld_TU_CLAVE" \\
  -F "file=@extracto-mayo.pdf"`}</CodeBlock>
              <p style={subheadStyle}>Ejemplo (JSON base64)</p>
              <CodeBlock>{`{
  "filename": "extracto-mayo.pdf",
  "data": "<contenido en base64>"
}`}</CodeBlock>
              <p style={subheadStyle}>Respuesta · 202</p>
              <CodeBlock>{`{ "id": "js7abc…", "status": "processing" }`}</CodeBlock>
            </Endpoint>

            <Endpoint id="get-statement" method="GET" path="/v1/statements/{id}">
              <p style={pStyle}>
                Estado de procesamiento de un extracto. Haz polling cada pocos
                segundos hasta que <InlineCode>status</InlineCode> sea{" "}
                <InlineCode>done</InlineCode> (o <InlineCode>error</InlineCode>).
                Mientras procesa, <InlineCode>progress</InlineCode> indica la
                fase y el avance.
              </p>
              <p style={subheadStyle}>Respuesta · 200</p>
              <CodeBlock>{`{
  "id": "js7abc…",
  "filename": "extracto-mayo.pdf",
  "fileType": "pdf",
  "status": "done",
  "transactionCount": 87,
  "uploadedAt": 1780640000000,
  "processedAt": 1780640090000,
  "progress": null,
  "error": null
}`}</CodeBlock>
            </Endpoint>

            <Endpoint id="get-statements" method="GET" path="/v1/statements">
              <p style={pStyle}>
                Lista los últimos 50 extractos (incluidos los importados por
                API), ordenados del más reciente al más antiguo. Devuelve{" "}
                <InlineCode>{`{ "items": [...] }`}</InlineCode> con la misma
                forma que el endpoint anterior.
              </p>
            </Endpoint>
          </Section>

          <Section id="transacciones" title="Transacciones">
            <Endpoint id="post-transactions" method="POST" path="/v1/transactions">
              <p style={pStyle}>
                Inserta transacciones ya estructuradas, sin archivo (máx. 1000
                por petición). Se crea un extracto virtual de tipo{" "}
                <InlineCode>api</InlineCode> y las transacciones pasan por las
                reglas del usuario y la IA igual que una subida normal. Importes:
                positivo = ingreso, negativo = gasto.
              </p>
              <ParamTable
                params={[
                  { name: "transactions", type: "array", desc: "Obligatorio. Objetos {date (YYYY-MM-DD), description, amount, merchant?}." },
                  { name: "source", type: "string", desc: "Opcional. Nombre de la fuente; aparece como nombre del extracto." },
                ]}
              />
              <p style={subheadStyle}>Ejemplo</p>
              <CodeBlock>{`curl -X POST ${API_BASE}/v1/transactions \\
  -H "Authorization: Bearer yld_TU_CLAVE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "mi-banco",
    "transactions": [
      { "date": "2026-06-01", "description": "MERCADONA VALENCIA", "amount": -42.5 },
      { "date": "2026-06-01", "description": "NOMINA EMPRESA SL", "amount": 1850 }
    ]
  }'`}</CodeBlock>
              <p style={subheadStyle}>Respuesta · 202</p>
              <CodeBlock>{`{ "id": "js7def…", "status": "processing", "received": 2 }`}</CodeBlock>
            </Endpoint>

            <Endpoint id="get-transactions" method="GET" path="/v1/transactions">
              <p style={pStyle}>
                Lista transacciones de la más reciente a la más antigua, con
                filtros y paginación por cursor.
              </p>
              <ParamTable
                params={[
                  { name: "month", type: "string", desc: "YYYY-MM. Atajo equivalente a from/to cubriendo el mes." },
                  { name: "from / to", type: "string", desc: "YYYY-MM-DD, inclusivos." },
                  { name: "category", type: "string", desc: "Nombre exacto de la categoría (sin distinguir mayúsculas)." },
                  { name: "type", type: "string", desc: "income o expense." },
                  { name: "includeExcluded", type: "boolean", desc: "Incluir transacciones excluidas del análisis. Por defecto false." },
                  { name: "limit", type: "number", desc: "1–500, por defecto 100." },
                  { name: "cursor", type: "string", desc: "Cursor devuelto por la página anterior." },
                ]}
              />
              <p style={subheadStyle}>Respuesta · 200</p>
              <CodeBlock>{`{
  "items": [
    {
      "id": "js7xyz…",
      "date": "2026-05-28",
      "description": "Pago en FNAC",
      "amount": -15.15,
      "category": "Ocio",
      "type": "expense",
      "merchant": null,
      "categorySource": "ai",
      "excluded": false
    }
  ],
  "cursor": "0739a2…",
  "isDone": false
}`}</CodeBlock>
              <p style={pStyle}>
                Los filtros <InlineCode>category</InlineCode> y{" "}
                <InlineCode>type</InlineCode> se aplican por página: una página
                puede traer menos elementos que <InlineCode>limit</InlineCode>.
                Sigue el <InlineCode>cursor</InlineCode> hasta que{" "}
                <InlineCode>isDone</InlineCode> sea <InlineCode>true</InlineCode>.
              </p>
            </Endpoint>
          </Section>

          <Section id="analisis" title="Análisis">
            <Endpoint id="get-summary" method="GET" path="/v1/summary">
              <p style={pStyle}>
                Agregado de un mes: ingresos, gastos, neto, desglose por
                categoría, top comercios y suscripciones detectadas. Las
                transacciones excluidas no cuentan. Parámetro obligatorio:{" "}
                <InlineCode>month=YYYY-MM</InlineCode>.
              </p>
              <p style={subheadStyle}>Respuesta · 200</p>
              <CodeBlock>{`{
  "month": "2026-05",
  "transactionCount": 112,
  "income": 703.67,
  "expenses": 1682.92,
  "net": -979.25,
  "byCategory": [
    { "category": "Supermercado", "total": 312.4, "count": 14, "percent": 19 }
  ],
  "topMerchants": [
    { "merchant": "MERCADONA", "total": 213.8, "count": 9, "category": "Supermercado" }
  ],
  "subscriptions": [
    { "merchant": "NETFLIX", "total": 12.99, "count": 1 }
  ]
}`}</CodeBlock>
            </Endpoint>

            <Endpoint id="get-insights" method="GET" path="/v1/insights">
              <p style={pStyle}>
                Insights de IA del mes (<InlineCode>month=YYYY-MM</InlineCode>).
                Si aún no se han generado, responde <InlineCode>404</InlineCode>;
                añade <InlineCode>&generate=true</InlineCode> para generarlos al
                momento (tarda unos segundos).
              </p>
              <p style={subheadStyle}>Respuesta · 200</p>
              <CodeBlock>{`{
  "month": "2026-05",
  "generatedAt": 1780640000000,
  "insights": [
    { "type": "warning", "text": "Gastaste 1.683€ frente a 704€ de ingresos: déficit de 979€" },
    { "type": "trend", "text": "Transferencias concentra el 43% del gasto del mes" },
    { "type": "suggestion", "text": "Revisa las 4 suscripciones activas: suman 188€/mes" }
  ]
}`}</CodeBlock>
            </Endpoint>

            <Endpoint id="get-categories" method="GET" path="/v1/categories">
              <p style={pStyle}>
                Taxonomía de categorías activa del usuario (incluye las
                personalizadas aprendidas durante el onboarding). Útil para
                validar el parámetro <InlineCode>category</InlineCode> de otros
                endpoints.
              </p>
              <p style={subheadStyle}>Respuesta · 200</p>
              <CodeBlock>{`{
  "items": [
    {
      "id": "supermercado",
      "name": "Supermercado",
      "description": "Compras en supermercados y tiendas de alimentación",
      "examples": ["Mercadona", "Lidl", "Carrefour"],
      "isDefault": true
    }
  ]
}`}</CodeBlock>
            </Endpoint>
          </Section>

          <Section id="errores" title="Errores">
            <p style={pStyle}>
              Todos los errores devuelven JSON con un código estable y un
              mensaje legible:
            </p>
            <CodeBlock>{`{ "error": { "code": "invalid_param", "message": "'month' debe ser YYYY-MM." } }`}</CodeBlock>
            <ParamTable
              params={[
                { name: "401", type: "code", desc: "missing_api_key / invalid_api_key — clave ausente, inválida o revocada." },
                { name: "402", type: "code", desc: "pro_required — la suscripción Pro no está activa; las claves quedan en pausa hasta reactivarla." },
                { name: "400", type: "code", desc: "invalid_body / invalid_param / invalid_transaction / unsupported_file_type / too_many_transactions." },
                { name: "404", type: "code", desc: "not_found / not_generated / no_data — recurso inexistente o sin datos." },
              ]}
            />
          </Section>

          <Section id="n8n" title="Integración con n8n">
            <p style={pStyle}>
              Usa el nodo <strong style={{ color: "var(--text)" }}>HTTP Request</strong>{" "}
              con autenticación de tipo <em>Header Auth</em> (nombre{" "}
              <InlineCode>Authorization</InlineCode>, valor{" "}
              <InlineCode>Bearer yld_…</InlineCode>). Flujos típicos:
            </p>
            <p style={pStyle}>
              <strong style={{ color: "var(--text)" }}>Subida automática de extractos</strong>{" "}
              — trigger de Gmail/IMAP que detecta el email del banco → HTTP
              Request <InlineCode>POST /v1/statements</InlineCode> con el
              adjunto como campo binario <InlineCode>file</InlineCode> → nodo
              Wait + <InlineCode>GET /v1/statements/{"{id}"}</InlineCode> en
              bucle hasta <InlineCode>status: &quot;done&quot;</InlineCode>.
            </p>
            <p style={pStyle}>
              <strong style={{ color: "var(--text)" }}>Resumen mensual a Telegram</strong>{" "}
              — Schedule Trigger el día 1 →{" "}
              <InlineCode>GET /v1/summary?month=…</InlineCode> (y opcionalmente{" "}
              <InlineCode>GET /v1/insights?month=…&generate=true</InlineCode>) →
              nodo Telegram/Email con el desglose.
            </p>
          </Section>

          {/* Footer */}
          <div
            style={{
              marginTop: 64,
              paddingTop: 24,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--text3)",
            }}
          >
            <span>© 2026 Yield · API v1</span>
            <Link href="/" style={{ color: "var(--text2)", textDecoration: "none" }}>
              ← Volver a yield
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
