"use client";
import { ReactNode, useState } from "react";

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
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(person || contexto?.candidato || contexto?.bloque || dias > 0);

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
          {onLogout && (
            <button type="button" className="ext-logout" onClick={onLogout} aria-label="Cerrar sesión">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
                <path d="M12 3v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M7 5.5a8 8 0 1 0 10 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {hasDetail && (
          <div className="ext-detail">
            <button
              type="button"
              className="ext-detail-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <span className="ext-detail-toggle-left">
                <span className="ext-live-dot" />
                <span className="ext-detail-toggle-name">{person || "Tu cuenta"}</span>
              </span>
              <span className={`ext-chevron ${expanded ? "is-open" : ""}`} aria-hidden="true">
                ⌄
              </span>
            </button>
            {expanded && (
              <div className="ext-detail-panel">
                {contexto?.candidato && (
                  <div className="ext-detail-row">
                    <span>Candidato</span>
                    <b>{contexto.candidato}</b>
                  </div>
                )}
                {contexto?.bloque && (
                  <div className="ext-detail-row">
                    <span>Bloque</span>
                    <b>{contexto.bloque}</b>
                  </div>
                )}
                {dias > 0 && (
                  <div className="ext-detail-row">
                    <span>Elección</span>
                    <b>9 de mayo · faltan {dias} días</b>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="ext-body">{children}</div>
    </main>
  );
}

export function ExternalSplash({ label = "Cargando tu cuenta…" }: { label?: string }) {
  return (
    <main className="ext-splash">
      <div className="ext-splash-ringwrap">
        <div className="ext-splash-ring" />
        <span className="ext-splash-badge">
          <img src="/pulso-electoral-logo.png" alt="" />
        </span>
      </div>
      <p className="ext-splash-label">{label}</p>
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
