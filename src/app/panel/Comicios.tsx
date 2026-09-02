"use client";
import { useEffect, useState } from "react";
import { UserCheck, Vote, CheckSquare, FileCheck } from "lucide-react";
import { rpc, formatDateTime } from "./shared";

type Stats = { fiscales_presentes: number; mesas_cerradas: number; votos_nagle: number; votantes_reportados: number };
type Mesa = {
  mesa: string;
  fiscal_nombre: string | null;
  presente_at: string | null;
  last_voter_count: number | null;
  last_reported_at: string | null;
  nagle_votes: number | null;
  acta_path: string | null;
  closed_at: string | null;
};

function FiscalesTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([rpc(token, "comicios_stats"), rpc(token, "list_comicios_mesas")]);
      setStats(s);
      setMesas(m || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  return (
    <div>
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon sky"><UserCheck size={18} strokeWidth={2} /></span>
            <b>{stats.fiscales_presentes}</b>
            <p>Fiscales presentes</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon green"><Vote size={18} strokeWidth={2} /></span>
            <b>{stats.votantes_reportados.toLocaleString("es-AR")}</b>
            <p>Votantes reportados</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon orange"><CheckSquare size={18} strokeWidth={2} /></span>
            <b>{stats.mesas_cerradas}</b>
            <p>Mesas cerradas</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon sky"><FileCheck size={18} strokeWidth={2} /></span>
            <b>{stats.votos_nagle.toLocaleString("es-AR")}</b>
            <p>Votos Nagle</p>
          </div>
        </div>
      )}
      <button className="ext-btn secondary" style={{ marginBottom: 12 }} onClick={load} disabled={loading}>
        {loading ? "ACTUALIZANDO…" : "ACTUALIZAR"}
      </button>
      {!loading && !mesas.length && <p className="empty">Todavía no hay reportes de mesas.</p>}
      <div className="log-list">
        {mesas.map((m) => (
          <div key={m.mesa} className="log-row" style={{ alignItems: "flex-start" }}>
            <span className={`badge ${m.closed_at ? "ok" : m.presente_at ? "neutral" : "danger"}`}>
              {m.closed_at ? "Cerrada" : m.presente_at ? "En curso" : "Sin fiscal"}
            </span>
            <div>
              <b>Mesa {m.mesa}</b>
              <p>
                {m.fiscal_nombre ? `Fiscal: ${m.fiscal_nombre}` : "Sin fiscal presente"}
                {m.presente_at ? ` · presente ${formatDateTime(m.presente_at)}` : ""}
              </p>
              <p>
                {m.last_voter_count != null ? `Votantes en mesa: ${m.last_voter_count} (${formatDateTime(m.last_reported_at!)})` : "Sin reporte de votantes"}
              </p>
              <p>
                {m.closed_at
                  ? `Cerrada ${formatDateTime(m.closed_at)} · Nagle: ${m.nagle_votes} · Acta ${m.acta_path ? "subida" : "sin subir"}`
                  : "Mesa aún no cerrada"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [{ key: "fiscales", label: "FISCALES" }] as const;
type TabKey = (typeof TABS)[number]["key"];

export function Comicios({ token, close }: { token: string; close: () => void }) {
  const [tab, setTab] = useState<TabKey>("fiscales");

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>COMICIOS</h1>
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
        {tab === "fiscales" && <FiscalesTab token={token} />}
      </section>
    </main>
  );
}
