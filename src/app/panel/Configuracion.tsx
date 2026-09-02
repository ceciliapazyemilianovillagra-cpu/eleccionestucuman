"use client";
import { useEffect, useState } from "react";
import { rpc, formatDateTime } from "./shared";
import { Users } from "./Users";

type LogRow = {
  id: number;
  occurred_at: string;
  source: "internal" | "external";
  module: string;
  action: string;
  actor_label: string | null;
  details: Record<string, unknown> | null;
};

type Claim = {
  id: string;
  status: string;
  voter_dni: string;
  voter_nombre: string;
  actor_dni: string;
  actor_nombre: string;
  owner_nombre: string | null;
  owner_internal_email: string | null;
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

function AlertsSection({ token }: { token: string }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  async function load(includeResolved: boolean) {
    setLoading(true);
    try {
      setClaims(await rpc(token, "list_voter_claims", { p_include_resolved: includeResolved }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(showResolved);
  }, [token, showResolved]);

  async function resolve(id: string) {
    await rpc(token, "resolve_voter_claim", { p_id: id }).catch(() => {});
    load(showResolved);
  }

  return (
    <div>
      <label className="module-checks" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ width: "auto" }} />
        <span>Mostrar también resueltos</span>
      </label>
      {loading && <p className="empty">Cargando…</p>}
      {!loading && !claims.length && <p className="empty">No hay reclamos {showResolved ? "" : "pendientes"}.</p>}
      <div className="log-list">
        {claims.map((c) => (
          <div key={c.id} className="log-row" style={{ alignItems: "flex-start" }}>
            <span className={`badge ${c.status === "unread" ? "danger" : "ok"}`}>{c.status === "unread" ? "Pendiente" : "Resuelto"}</span>
            <div>
              <b>
                {c.actor_nombre} (DNI {c.actor_dni}) reclama a {c.voter_nombre} (DNI {c.voter_dni})
              </b>
              <p>Cargado por {c.owner_nombre || c.owner_internal_email || "un interno"}</p>
              {c.status === "unread" && (
                <button className="ext-btn secondary" style={{ marginTop: 8 }} onClick={() => resolve(c.id)}>
                  MARCAR RESUELTO
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
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

const TABS = [
  { key: "usuarios", label: "USUARIOS" },
  { key: "alertas", label: "ALERTAS" },
  { key: "links", label: "ENLACES" },
  { key: "logs", label: "LOGS" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function Configuracion({ token, close }: { token: string; close: () => void }) {
  const [tab, setTab] = useState<TabKey>("usuarios");

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
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === "usuarios" && <Users token={token} />}
        {tab === "alertas" && <AlertsSection token={token} />}
        {tab === "links" && <LinksSection />}
        {tab === "logs" && <LogsSection token={token} />}
      </section>
    </main>
  );
}
