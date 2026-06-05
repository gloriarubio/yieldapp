import Anthropic from "@anthropic-ai/sdk";

export type InsightType = "warning" | "trend" | "suggestion";

export type Insight = {
  type: InsightType;
  text: string;
};

type TopCategory = {
  nombre: string;
  total: number;
  porcentaje: number;
};

export type InsightSummary = {
  totalIngresos: number;
  totalGastos: number;
  ahorro: number;
  mes: string;
  año: number;
  topCategorias: TopCategory[];
};

export async function generateInsights(summary: InsightSummary): Promise<Insight[] | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Eres un analizador financiero personal. Analiza estos datos del usuario para el mes de ${summary.mes} ${summary.año}:

RESUMEN: ${JSON.stringify(summary)}

Genera exactamente 3 insights sobre los datos. Cada insight debe ser concreto, usar números reales de los datos y tener máximo 120 caracteres.

Clasifica cada insight con uno de estos tipos:
- "warning": déficit, gasto muy por encima de la media, situación que requiere atención
- "trend": patrón detectado, comparativa con meses anteriores, tendencia de una categoría
- "suggestion": acción concreta que puede mejorar el ahorro

Responde ÚNICAMENTE con un array JSON válido, sin markdown, sin texto adicional, con este formato exacto:
[{"type":"warning","text":"..."},{"type":"trend","text":"..."},{"type":"suggestion","text":"..."}]`,
        },
      ],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(text) as Insight[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
