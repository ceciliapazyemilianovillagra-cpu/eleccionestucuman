"use client";
import { useEffect, useState } from "react";
import { rpc, formatDateTime } from "./shared";

type LogRow = {
  id: number;
  occurred_at: string;
  source: "internal" | "external";
  module: string;
  action: string;
  actor_label: string | null;
  details: Record<string, unknown> | null;
};

const EXTERNAL_LINKS = [
  { path: "/movilizadores", label: "Movilizadores", desc: "Portal para movilizadores: carga de votantes y traslado el día de la elección." },
  { path: "/choferes", label: "Choferes", desc: "Portal para choferes: carga de votantes y traslado el día de la elección." },
  { path: "/fiscales", label: "Fiscales", desc: "Portal para fiscales de mesa: presencia, votantes en mesa y cierre de comicio." },
];

function LinksSection() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="results">
      {EXTERNAL_LINKS.map((link) => {
        const url = origin ? `${origin}${link.path}` : link.path;
        return (
          <div key={link.path} className="link-row">
            <div>
              <b>{link.label}</b>
              <p>{link.desc}</p>
              <code>{url}</code>
            </div>
            <button className="ext-btn secondary" onClick={() => copy(url)} disabled={!origin}>
              {copied === url ? "COPIADO ✓" : "COPIAR"}
            </button>
          </div>
        );
      })}
      <p className="ext-note">Compartí cada enlace con el grupo correspondiente. El acceso lo da igual el DNI + código único que se genera desde la ficha del votante en Padrón.</p>
    </div>
  );
}

function LogsSection({ token }: { token: string }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    rpc(token, "list_activity_log", { p_limit: 200 })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return r.module.includes(q) || r.action.includes(q) || (r.actor_label ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <label className="users-search">
        <span>⌕</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por módulo, acción o usuario" />
      </label>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !filtered.length && <p className="empty">Sin registros.</p>}
      <div className="log-list">
        {filtered.map((r) => (
          <div key={r.id} className="log-row">
            <span className={`badge ${r.source === "internal" ? "ok" : "neutral"}`}>{r.source === "internal" ? "Interno" : "Externo"}</span>
            <div>
              <b>
                {r.module} · {r.action}
              </b>
              <p>
                {r.actor_label || "—"} · {formatDateTime(r.occurred_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Configuracion({ token, close }: { token: string; close: () => void }) {
  const [tab, setTab] = useState<"links" | "logs">("links");

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>CONFIGURACIÓN</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="config-tabs">
          <button className={tab === "links" ? "active" : ""} onClick={() => setTab("links")}>
            ENLACES EXTERNOS
          </button>
          <button className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
            LOGS DE LA APP
          </button>
        </div>
        {tab === "links" ? <LinksSection /> : <LogsSection token={token} />}
      </section>
    </main>
  );
}
