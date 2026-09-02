"use client";
import { ReactNode } from "react";

export function ExternalShell({
  eyebrow,
  title,
  person,
  onBack,
  onLogout,
  children,
}: {
  eyebrow: string;
  title: string;
  person?: string;
  onBack?: () => void;
  onLogout?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="ext">
      <div className="ext-topbar">
        <div className="ext-topbar-left">
          {onBack && (
            <button type="button" className="ext-iconbtn" onClick={onBack} aria-label="Volver">
              ←
            </button>
          )}
          <div>
            <small>{eyebrow}</small>
            <h1>{title}</h1>
          </div>
        </div>
        {onLogout && (
          <button type="button" className="ext-logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        )}
      </div>
      {person && <p className="ext-person">Hola, {person}</p>}
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
