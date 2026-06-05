"use client";

import { useEffect, useRef, useState } from "react";

const faqs = [
  { q: "¿Son seguros mis extractos bancarios?", a: "Sí. Usamos cifrado en tránsito (TLS) y en reposo para todos los archivos subidos. Tus datos financieros nunca se comparten con terceros ni se usan para entrenar ningún modelo de IA." },
  { q: "¿Con qué bancos es compatible?", a: "Con cualquier banco que permita exportar extractos en PDF, Excel o CSV. Compatible con Santander, BBVA, CaixaBank, ING, N26, Revolut y cualquier otra entidad española o europea que ofrezca descarga de movimientos." },
  { q: "¿Necesito dar acceso a mi banco?", a: "No, nunca. Yield no se conecta con ningún banco directamente. Tú exportas el extracto desde tu banca online y lo subes a Yield. Sin credenciales, sin open banking, sin ningún permiso bancario." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí, sin compromisos ni permanencia. Cancela desde los ajustes de tu cuenta en cualquier momento y no se te cobrará el siguiente período. No hay letras pequeñas." },
  { q: "¿Qué pasa con mis datos si cancelo?", a: "Tienes 30 días desde la cancelación para exportar todo tu historial. Transcurrido ese plazo, todos tus datos —extractos, análisis e historial— se eliminan permanentemente de nuestros servidores." },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    el.querySelectorAll(".reveal").forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="faq" style={{ padding: "0 52px 110px", maxWidth: 1160, margin: "0 auto" }}>
      <div className="reveal" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.8px", color: "var(--accent)" }}>FAQ</span>
      </div>
      <div className="reveal r1" style={{ marginBottom: 58 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(34px,4vw,58px)", fontWeight: 500, lineHeight: 1.13, letterSpacing: "-1.5px", color: "var(--text)" }}>
          Preguntas frecuentes
        </h2>
      </div>

      <div className="reveal r2" style={{ maxWidth: 720 }}>
        {faqs.map((faq, i) => (
          <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "22px 0", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 500, color: open === i ? "var(--accent)" : "var(--text)", fontFamily: "inherit", transition: "color 0.2s" }}
            >
              {faq.q}
              <span style={{ width: 22, height: 22, flexShrink: 0, border: "1px solid var(--border2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: open === i ? "var(--accent)" : "var(--text2)", borderColor: open === i ? "var(--accent)" : "var(--border2)", transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.3s var(--ease), border-color 0.2s, color 0.2s" }}>
                +
              </span>
            </button>
            <div style={{ maxHeight: open === i ? 200 : 0, overflow: "hidden", transition: "max-height 0.42s var(--ease)" }}>
              <p style={{ paddingBottom: 22, fontSize: 14, color: "var(--text2)", lineHeight: 1.72 }}>{faq.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
