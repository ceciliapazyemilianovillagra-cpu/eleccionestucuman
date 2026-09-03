"use client";
import { FormEvent, useEffect, useState } from "react";
import "../external/external.css";
import "../panel/panel.css";
import { callFn, clearToken, loadToken, saveToken } from "../external/api";
import { ExternalLoginCard, ExternalShell } from "../external/ExternalShell";

const FN = "candidato";

type Dashboard = {
  kpis: { colaboradores: number; movilizadores_activos: number; choferes_asignados: number; fiscales_presentes: number; mesas_cerradas: number; votos_nagle: number; votantes_reportados: number };
  top_movilizadores: { movilizador_nombre: string; cantidad: number }[];
  funnel: { cargados: number; buscados: number; votando: number; devueltos: number };
  mesas: { cerradas: number; en_curso: number; sin_fiscal_reportado: number };
  coverage: { circuito_nombre: string; mesas_totales: number; mesas_con_fiscal: number; pct: number | null }[];
  alertas: { voter_nombre: string; actor_nombre: string; owner_nombre: string }[];
};

export default function Candidato() {
  const [token, setToken] = useState("");
  const [person, setPerson] = useState("");
  const [dni, setDni] = useState("");
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = loadToken(FN);
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function load() {
    setLoading(true);
    const d = await callFn(FN, token, { action: "dashboard" });
    setData(d);
    setLoading(false);
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const d = await callFn(FN, "", { action: "login", dni, code });
    setLoggingIn(false);
    if (d.token) {
      setToken(d.token);
      setPerson(d.person?.nombre ?? "");
      saveToken(FN, d.token);
    } else {
      setLoginError(d.error || "No se pudo ingresar.");
    }
  }

  async function logout() {
    await callFn(FN, token, { action: "logout" });
    clearToken(FN);
    setToken("");
    setData(null);
  }

  if (!token) {
    return (
      <ExternalLoginCard>
        <form onSubmit={login}>
          <img src="/icon.svg" alt="Elecciones Tucumán" />
          <small>ACCESO EXTERNO</small>
          <h1>Candidato</h1>
          <p>Sala de situación de la campaña.</p>
          <label>DNI</label>
          <input required inputMode="numeric" placeholder="Tu DNI" value={dni} onChange={(e) => setDni(e.target.value)} />
          <label>Código único</label>
          <input required placeholder="Código de acceso" value={code} onChange={(e) => setCode(e.target.value)} />
          <button disabled={loggingIn}>{loggingIn ? "INGRESANDO..." : "INGRESAR"}</button>
          {loginError && <b className="ext-error">{loginError}</b>}
        </form>
      </ExternalLoginCard>
    );
  }

  const maxTop = Math.max(1, ...(data?.top_movilizadores.map((m) => m.cantidad) ?? [1]));
  const totalMesas = data ? data.mesas.cerradas + data.mesas.en_curso + data.mesas.sin_fiscal_reportado : 0;

  return (
    <ExternalShell eyebrow="CANDIDATO" title="Sala de situación" person={person} onLogout={logout}>
      <button className="ext-btn secondary" style={{ marginBottom: 14 }} onClick={load} disabled={loading}>
        {loading ? "ACTUALIZANDO…" : "ACTUALIZAR"}
      </button>
      {loading && !data && <p className="empty">Cargando…</p>}
      {data && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <b>{data.kpis.colaboradores.toLocaleString("es-AR")}</b>
              <p>Colaboradores cargados</p>
            </div>
            <div className="stat-card">
              <b>{data.kpis.movilizadores_activos}</b>
              <p>Movilizadores activos</p>
            </div>
            <div className="stat-card">
              <b>{data.kpis.choferes_asignados}</b>
              <p>Choferes asignados</p>
            </div>
            <div className="stat-card">
              <b>{data.kpis.fiscales_presentes}</b>
              <p>Fiscales presentes</p>
            </div>
            <div className="stat-card">
              <b>{data.kpis.votantes_reportados.toLocaleString("es-AR")}</b>
              <p>Votantes reportados</p>
            </div>
            <div className="stat-card">
              <b>{data.kpis.votos_nagle.toLocaleString("es-AR")}</b>
              <p>Votos Nagle</p>
            </div>
          </div>

          <section className="ext-card">
            <h2>Colaboradores por movilizador</h2>
            <p className="ext-hint">Top movilizadores por cantidad cargada.</p>
            {!data.top_movilizadores.length && <p className="empty">Todavía no hay colaboradores cargados.</p>}
            <div className="results" style={{ gap: 8 }}>
              {data.top_movilizadores.map((m) => (
                <div key={m.movilizador_nombre} style={{ display: "grid", gridTemplateColumns: "140px 1fr 34px", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.movilizador_nombre}</span>
                  <div style={{ height: 14, background: "#eef3f9", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(m.cantidad / maxTop) * 100}%`, background: "var(--blue)", borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, textAlign: "right" }}>{m.cantidad}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="ext-card">
            <h2>Estado de mesas</h2>
            <p className="ext-hint">{totalMesas} mesas con algún reporte.</p>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <div className="stat-card">
                <b style={{ color: "var(--green)" }}>{data.mesas.cerradas}</b>
                <p>Cerradas</p>
              </div>
              <div className="stat-card">
                <b style={{ color: "var(--orange)" }}>{data.mesas.en_curso}</b>
                <p>En curso</p>
              </div>
              <div className="stat-card">
                <b style={{ color: "#b52a21" }}>{data.mesas.sin_fiscal_reportado}</b>
                <p>Sin fiscal</p>
              </div>
            </div>
          </section>

          <section className="ext-card">
            <h2>Relación movilizador → traslado</h2>
            <p className="ext-hint">Sobre {data.funnel.cargados} colaboradores cargados.</p>
            <div className="results" style={{ gap: 8 }}>
              {[
                { label: "Cargados", value: data.funnel.cargados, color: "var(--blue)" },
                { label: "Buscados", value: data.funnel.buscados, color: "var(--orange)" },
                { label: "Votando", value: data.funnel.votando, color: "var(--navy)" },
                { label: "Devueltos", value: data.funnel.devueltos, color: "var(--green)" },
              ].map((row) => (
                <div key={row.label} style={{ display: "grid", gridTemplateColumns: "100px 1fr 50px", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{row.label}</span>
                  <div style={{ height: 14, background: "#eef3f9", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${data.funnel.cargados ? (row.value / data.funnel.cargados) * 100 : 0}%`, background: row.color, borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, textAlign: "right", color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="ext-card">
            <h2>Alertas</h2>
            <p className="ext-hint">Reclamos de colaboradores sin resolver.</p>
            {!data.alertas.length && <p className="empty">Sin reclamos pendientes.</p>}
            <div className="log-list">
              {data.alertas.map((a, i) => (
                <div key={i} className="log-row">
                  <span className="badge danger">Reclamo</span>
                  <div>
                    <b>
                      {a.actor_nombre} reclama a {a.voter_nombre}
                    </b>
                    <p>Cargado por {a.owner_nombre}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ext-card">
            <h2>Circuitos con menor cobertura</h2>
            <p className="ext-hint">Porcentaje de mesas con fiscal presente.</p>
            <div className="log-list">
              {data.coverage.map((c) => (
                <div key={c.circuito_nombre} className="log-row">
                  <span className={`badge ${c.pct == null ? "neutral" : c.pct >= 85 ? "ok" : c.pct >= 60 ? "neutral" : "danger"}`}>{c.pct == null ? "-" : `${c.pct}%`}</span>
                  <div>
                    <b>{c.circuito_nombre}</b>
                    <p>
                      {c.mesas_con_fiscal} de {c.mesas_totales} mesas con fiscal
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </ExternalShell>
  );
}
