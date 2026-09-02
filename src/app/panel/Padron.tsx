"use client";
import { FormEvent, useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, Voter, rpc } from "./shared";
import { VoterSheet } from "./VoterSheet";

type Stats = { total_votantes: number; total_mesas: number; total_circuitos: number; por_rol: { role: string; count: number }[] };

const ROLE_LABELS: Record<string, string> = {
  dirigente: "Dirigentes", chofer: "Choferes", movilizador: "Movilizadores", coordinador_circuito: "Coord. circuito",
  fiscal_general: "Fiscales generales", fiscal_mesa: "Fiscales de mesa", fiscal_suplente: "Fiscales suplentes",
  colaborador: "Colaboradores", coordinador_general: "Coord. general",
};

export function Padron({ token, close }: { token: string; close: () => void }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Voter | null>(null);
  const [message, setMessage] = useState("Buscá por DNI completo, apellido o nombre.");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    rpc(token, "padron_stats").then(setStats).catch(() => {});
  }, [token]);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const clean = query.trim();

    if (clean.length < 2) {
      setRows([]);
      setMessage("Escribí al menos 2 caracteres para buscar.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: clean, p_limit: 50 }),
      });
      const data = await response.json();

      if (!response.ok) {
        setRows([]);
        setMessage("No se pudo consultar el padrón. Intentá nuevamente.");
        return;
      }

      setRows(data);
      if (!data.length) setMessage("No encontramos coincidencias.");
    } catch {
      setRows([]);
      setMessage("No hay conexión. Revisá internet e intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>PADRÓN</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon sky">👥</span>
              <b>{stats.total_votantes.toLocaleString("es-AR")}</b>
              <p>Votantes</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon green">🗳️</span>
              <b>{stats.total_mesas.toLocaleString("es-AR")}</b>
              <p>Mesas</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon orange">📍</span>
              <b>{stats.total_circuitos.toLocaleString("es-AR")}</b>
              <p>Circuitos</p>
            </div>
            {stats.por_rol.map((r) => (
              <div className="stat-card" key={r.role}>
                <span className="stat-icon sky">☑</span>
                <b>{r.count.toLocaleString("es-AR")}</b>
                <p>{ROLE_LABELS[r.role] ?? r.role}</p>
              </div>
            ))}
          </div>
        )}
        <form className="search-card" onSubmit={search}>
          <label>
            Buscar votante
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="DNI, apellido o nombre" inputMode="search" autoComplete="off" autoFocus />
          </label>
          <button disabled={loading}>{loading ? "BUSCANDO…" : "BUSCAR"}</button>
        </form>
        <div className="results-head">
          <b>Resultados</b>
          <span>{rows.length} mostrados</span>
        </div>
        {message && <p className="empty">{message}</p>}
        <div className="results">
          {rows.map((v) => (
            <button key={v.id} className="voter-row" onClick={() => setSelected(v)}>
              <span className="avatar">{v.apellido_nombre.slice(0, 1)}</span>
              <div>
                <b>{v.apellido_nombre}</b>
                <p>
                  DNI {v.dni} · Mesa {v.mesa}
                </p>
              </div>
              <span>›</span>
            </button>
          ))}
        </div>
      </section>
      {selected && <VoterSheet voter={selected} token={token} close={() => setSelected(null)} />}
    </main>
  );
}
