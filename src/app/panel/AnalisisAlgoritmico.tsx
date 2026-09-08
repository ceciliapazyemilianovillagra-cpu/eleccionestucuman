"use client";
import { BrainCircuit, Radio, Newspaper, Sparkles } from "lucide-react";
import { ScrollTopButton } from "./ScrollTopButton";

export function AnalisisAlgoritmico({ close }: { token: string; close: () => void }) {
  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>ANÁLISIS ALGORÍTMICO</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="search-card" style={{ display: "grid", gap: 14, textAlign: "center", padding: "32px 20px" }}>
          <span style={{ margin: "0 auto", width: 56, height: 56, borderRadius: 16, background: "var(--sky)", display: "grid", placeItems: "center", color: "var(--navy)" }}>
            <BrainCircuit size={26} strokeWidth={2} />
          </span>
          <div>
            <p className="eyebrow" style={{ margin: "0 0 6px" }}>PRÓXIMAMENTE</p>
            <b style={{ display: "block", color: "var(--navy)", fontSize: 16 }}>Monitoreo automático de medios</b>
          </div>
          <p className="ext-note" style={{ margin: "0 auto", maxWidth: 340 }}>
            Este módulo va a rastrear diariamente los medios digitales de Tucumán y contar cuánto y cómo se habla de <b>Tucumán</b>, <b>San Miguel de Tucumán</b> y el <b>concejal Ernesto Nagle</b>, usando IA (Gemini) para clasificar el tono de cada nota.
          </p>
        </div>

        <p className="eyebrow" style={{ margin: "22px 2px 10px" }}>QUÉ FALTA PARA ACTIVARLO</p>
        <div className="log-list">
          <div className="log-row" style={{ alignItems: "flex-start" }}>
            <span className="badge neutral">1</span>
            <div>
              <b>Lista de medios a rastrear</b>
              <p>Confirmar los medios digitales tucumanos (y sus RSS) que querés monitorear.</p>
            </div>
          </div>
          <div className="log-row" style={{ alignItems: "flex-start" }}>
            <span className="badge neutral">2</span>
            <div>
              <b>API key de Gemini (gratis)</b>
              <p>Se genera en Google AI Studio en un par de minutos, y se guarda de forma segura del lado del servidor.</p>
            </div>
          </div>
          <div className="log-row" style={{ alignItems: "flex-start" }}>
            <span className="badge neutral">3</span>
            <div>
              <b>Confirmar dónde va el análisis</b>
              <p>Menciones por día, tono (favorable/neutro/desfavorable) y el link a cada nota original.</p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 26, color: "var(--muted)" }}>
          <Newspaper size={18} strokeWidth={1.75} />
          <Radio size={18} strokeWidth={1.75} />
          <Sparkles size={18} strokeWidth={1.75} />
        </div>
      </section>
      <ScrollTopButton />
    </main>
  );
}
