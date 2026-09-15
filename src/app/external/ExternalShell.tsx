"use client";
import { ReactNode } from "react";

const ELECTION_DATE = new Date("2027-05-09T00:00:00-03:00");

function diasParaLaEleccion() {
  const ms = ELECTION_DATE.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function ExternalShell({
  eyebrow,
  title,
  person,
  contexto,
  onBack,
  onLogout,
  children,
}: {
  eyebrow: string;
  title: string;
  person?: string;
  contexto?: { candidato: string | null; bloque: string | null } | null;
  onBack?: () => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  const dias = diasParaLaEleccion();
  const contextoLabel = contexto?.candidato ? `${contexto.candidato}${contexto.bloque ? ` · ${contexto.bloque}` : ""}` : null;

  return (
    <main className="ext">
      <div className="ext-topbar">
        <div className="ext-topbar-top">
          <div className="ext-topbar-left">
            {onBack && (
              <button type="button" className="ext-iconbtn" onClick={onBack} aria-label="Volver">
                ←
              </button>
            )}
            <span className="ext-logo-badge">
              <img src="/pulso-electoral-logo.png" alt="" />
            </span>
            <div>
              <small>{eyebrow}</small>
              <h1>{title}</h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            <span className="ext-live" aria-label="Conexión en vivo">
              <span className="ext-live-dot" />
              En vivo
            </span>
            {onLogout && (
              <button type="button" className="ext-logout" onClick={onLogout}>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
        {(person || contextoLabel) && (
          <div className="ext-person-row">
            {person && <span className="ext-person-pill">{person}</span>}
            {contextoLabel && <span className="ext-context-pill">{contextoLabel}</span>}
          </div>
        )}
        {dias > 0 && <small className="ext-countdown">Faltan {dias} días para el 9 de mayo</small>}
      </div>
      <div className="ext-body">{children}</div>
    </main>
  );
}

export function ExternalLoginCard({ children }: { children: ReactNode }) {
  return (
    <main className="ext ext-login">
      <div className="ext-login-card">{children}</div>
    </main>
  );
}
