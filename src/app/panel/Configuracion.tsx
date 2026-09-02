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

export function Configuracion({ token, close }: { token: string; close: () => void }) {
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
        <p className="eyebrow" style={{ margin: "6px 2px" }}>LOGS DE LA APP</p>
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
      </section>
    </main>
  );
}
