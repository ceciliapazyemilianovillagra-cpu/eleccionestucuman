"use client";
import { FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ShieldCheck, Vote } from "lucide-react";
import { rpc, formatDateTime, SUPABASE_URL, SUPABASE_KEY, Voter } from "./shared";
import { RoleRoster } from "./RoleRoster";
import { VoterSheet } from "./VoterSheet";
import { ScrollTopButton } from "./ScrollTopButton";
import { useRealtime } from "./realtime";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <p className="empty">Cargando mapa…</p> });

function pct(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

type Stats = {
  fiscales_presentes: number;
  total_fiscales: number;
  mesas_cerradas: number;
  total_mesas: number;
  votos_nagle: number;
  votantes_reportados: number;
};
type Mesa = {
  mesa: string;
  fiscal_nombre: string | null;
  presente_at: string | null;
  last_voter_count: number | null;
  last_reported_at: string | null;
  nagle_votes: number | null;
  acta_path: string | null;
  closed_at: string | null;
  escuela_id: number | null;
  escuela_nombre: string | null;
  circuito_codigo: string | null;
};
type Escuela = { id: number; circuito: string; circuito_num: string; nombre: string; direccion: string | null; mesa_desde: number; mesa_hasta: number; cant_mesas: number };

function FiscalesTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<Voter[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [selected, setSelected] = useState<Voter | null>(null);
  const [view, setView] = useState<"mesas" | "escuelas">("mesas");
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [circFilter, setCircFilter] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/escuelas?select=id,circuito,circuito_num,nombre,direccion,mesa_desde,mesa_hasta,cant_mesas&order=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((rows) => setEscuelas(Array.isArray(rows) ? rows : []))
      .catch(() => setEscuelas([]));
  }, [token]);

  const porEscuela = escuelas
    .filter((e) => !circFilter || e.circuito_num === circFilter)
    .map((e) => {
      const rows = mesas.filter((m) => m.escuela_id === e.id);
      return {
        ...e,
        cerradas: rows.filter((m) => m.closed_at).length,
        presentes: rows.filter((m) => m.presente_at).length,
        votantes: rows.reduce((n, m) => n + (m.last_voter_count ?? 0), 0),
        votos: rows.reduce((n, m) => n + (m.closed_at ? m.nagle_votes ?? 0 : 0), 0),
      };
    });
  const circuitosLista = Array.from(new Set(escuelas.map((e) => e.circuito_num))).sort((a, b) => Number(a) - Number(b));

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

  useRealtime(["fiscal_attendance", "fiscal_turnout_reports", "fiscal_closures"], token, load);

  async function searchToAdd(e: FormEvent) {
    e.preventDefault();
    if (addQuery.trim().length < 2) return;
    setAddSearching(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_padron`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_query: addQuery, p_limit: 20 }),
      });
      setAddResults(await response.json());
    } finally {
      setAddSearching(false);
    }
  }

  async function verActa(mesa: string) {
    const w = window.open("", "_blank");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/comicios`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acta_url", mesa }),
      });
      const d = await res.json();
      if (d.url && w) {
        w.location.href = d.url;
      } else {
        w?.close();
        window.alert(d.error || "No se pudo abrir el acta.");
      }
    } catch {
      w?.close();
      window.alert("No se pudo abrir el acta. Revisá tu conexión.");
    }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = view === "escuelas"
      ? porEscuela.map((e) => ({
          Escuela: e.nombre,
          Circuito: e.circuito,
          Direccion: e.direccion ?? "",
          "Mesas (total)": e.cant_mesas,
          "Mesas cerradas": e.cerradas,
          "Mesas con fiscal presente": e.presentes,
          "Votantes reportados": e.votantes,
          "Votos del candidato": e.votos,
        }))
      : mesas.map((m) => ({
      Mesa: m.mesa,
      Escuela: m.escuela_nombre ?? "",
      Circuito: m.circuito_codigo ?? "",
      Fiscal: m.fiscal_nombre ?? "",
      "Presente desde": m.presente_at ? formatDateTime(m.presente_at) : "",
      "Últ. votantes en mesa": m.last_voter_count ?? "",
      "Votos del candidato": m.nagle_votes ?? "",
      "Acta subida": m.acta_path ? "Sí" : "No",
      "Cerrada": m.closed_at ? formatDateTime(m.closed_at) : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comicios");
    XLSX.writeFile(wb, "comicios_fiscales.xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.text("Comicios · Fiscales", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: view === "escuelas" ? [["Escuela", "Circ.", "Mesas", "Cerradas", "Presentes", "Votantes", "Votos"]] : [["Mesa", "Escuela", "Fiscal", "Votantes", "Votos", "Acta", "Cerrada"]],
      body: view === "escuelas"
        ? porEscuela.map((e) => [e.nombre, e.circuito, e.cant_mesas, e.cerradas, e.presentes, e.votantes, e.votos])
        : mesas.map((m) => [m.mesa, m.escuela_nombre ?? "", m.fiscal_nombre ?? "", m.last_voter_count ?? "", m.nagle_votes ?? "", m.acta_path ? "Sí" : "No", m.closed_at ? formatDateTime(m.closed_at) : "No"]),
      styles: { fontSize: 8 },
    });
    doc.save("comicios_fiscales.pdf");
  }

  return (
    <div>
      {stats && (
        <div className="progress-stats">
          <div className="progress-card blue">
            <div className="progress-card-top">
              <span className="progress-chip"><ShieldCheck size={17} strokeWidth={2} /></span>
              <div>
                <b>Fiscales presentes</b>
                <small>de {stats.total_fiscales} fiscales asignados</small>
              </div>
            </div>
            <div className="progress-bar"><i style={{ width: `${pct(stats.fiscales_presentes, stats.total_fiscales)}%` }} /></div>
            <div className="progress-pct"><span>{stats.fiscales_presentes} presentes</span><span>{pct(stats.fiscales_presentes, stats.total_fiscales)}%</span></div>
          </div>
          <div className="progress-card navy">
            <div className="progress-card-top">
              <span className="progress-chip"><Vote size={17} strokeWidth={2} /></span>
              <div>
                <b>Mesas cerradas</b>
                <small>de {stats.total_mesas} mesas totales</small>
              </div>
            </div>
            <div className="progress-bar"><i style={{ width: `${pct(stats.mesas_cerradas, stats.total_mesas)}%` }} /></div>
            <div className="progress-pct"><span>{stats.mesas_cerradas} mesas</span><span>{pct(stats.mesas_cerradas, stats.total_mesas)}%</span></div>
          </div>
          <div className="stat-card" style={{ "--stat-accent": "var(--blue)" } as React.CSSProperties}>
            <span className="stat-seal"><b>{stats.votantes_reportados.toLocaleString("es-AR")}</b></span>
            <p>Votantes reportados</p>
          </div>
          <div className="stat-card" style={{ "--stat-accent": "var(--navy)" } as React.CSSProperties}>
            <span className="stat-seal"><b>{stats.votos_nagle.toLocaleString("es-AR")}</b></span>
            <p>Votos del candidato</p>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <button className="ext-btn full" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? "CANCELAR" : "+ AGREGAR FISCAL"}
        </button>
      </div>
      {addOpen && (
        <div className="search-card" style={{ marginBottom: 16 }}>
          <form onSubmit={searchToAdd} className="ext-field-row">
            <input placeholder="Buscar por DNI o nombre en el padrón" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} />
            <button className="ext-btn" disabled={addSearching}>{addSearching ? "BUSCANDO…" : "BUSCAR"}</button>
          </form>
          {addSearching && <p className="empty">Buscando…</p>}
          <div className="results" style={{ marginTop: 10 }}>
            {addResults.map((v) => (
              <button
                key={v.id}
                className="voter-row compact"
                onClick={() => {
                  setSelected(v);
                  setAddOpen(false);
                  setAddResults([]);
                  setAddQuery("");
                }}
              >
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
        </div>
      )}
      <div className="config-tabs" style={{ marginBottom: 12 }}>
        <button className={view === "mesas" ? "active" : ""} onClick={() => setView("mesas")}>POR MESA</button>
        <button className={view === "escuelas" ? "active" : ""} onClick={() => setView("escuelas")}>POR ESCUELA</button>
      </div>
      <div className="export-row" style={{ marginBottom: 0 }}>
        <button className="ext-btn secondary" onClick={load} disabled={loading}>
          {loading ? "ACTUALIZANDO…" : "ACTUALIZAR"}
        </button>
        <button className="ext-btn secondary" onClick={exportExcel} disabled={!mesas.length}>
          EXPORTAR EXCEL
        </button>
        <button className="ext-btn secondary" onClick={exportPdf} disabled={!mesas.length}>
          EXPORTAR PDF
        </button>
      </div>
      {view === "escuelas" && (
        <>
          <select value={circFilter} onChange={(e) => setCircFilter(e.target.value)} style={{ margin: "12px 0", maxWidth: 260 }}>
            <option value="">Todos los circuitos</option>
            {circuitosLista.map((c) => (
              <option key={c} value={c}>Circuito {c}</option>
            ))}
          </select>
          {!escuelas.length && <p className="empty">No se pudieron cargar las escuelas.</p>}
          <div className="log-list">
            {porEscuela.map((e) => (
              <div key={e.id} className="log-row" style={{ alignItems: "flex-start" }}>
                <span className={`badge ${e.cerradas === e.cant_mesas ? "ok" : "neutral"}`}>{e.cerradas}/{e.cant_mesas}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{e.nombre}</b>
                  <p>
                    Circ. {e.circuito}{e.direccion ? ` · ${e.direccion}` : ""} · mesas {e.mesa_desde}-{e.mesa_hasta}
                  </p>
                  <p>
                    {e.presentes} con fiscal presente · {e.votantes.toLocaleString("es-AR")} votantes reportados{e.cerradas ? ` · ${e.votos.toLocaleString("es-AR")} votos` : ""}
                  </p>
                  <div className="progress-bar" style={{ marginTop: 6 }}><i style={{ width: `${pct(e.cerradas, e.cant_mesas)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {view === "mesas" && !loading && !mesas.length && <p className="empty">Todavía no hay reportes de mesas.</p>}
      <div className="log-list">
        {view === "mesas" && mesas.map((m) => (
          <div key={m.mesa} className="log-row" style={{ alignItems: "flex-start" }}>
            <span className={`badge ${m.closed_at ? "ok" : m.presente_at ? "neutral" : "danger"}`}>
              {m.closed_at ? "Cerrada" : m.presente_at ? "En curso" : "Sin fiscal"}
            </span>
            <div>
              <b>Mesa {m.mesa}</b>
              {m.escuela_nombre && (
                <p>
                  {m.escuela_nombre} · Circ. {m.circuito_codigo}
                </p>
              )}
              <p>
                {m.fiscal_nombre ? `Fiscal: ${m.fiscal_nombre}` : "Sin fiscal presente"}
                {m.presente_at ? ` · presente ${formatDateTime(m.presente_at)}` : ""}
              </p>
              <p>
                {m.last_voter_count != null ? `Votantes en mesa: ${m.last_voter_count} (${formatDateTime(m.last_reported_at!)})` : "Sin reporte de votantes"}
              </p>
              <p>
                {m.closed_at
                  ? `Cerrada ${formatDateTime(m.closed_at)} · Votos: ${m.nagle_votes} · Acta ${m.acta_path ? "subida" : "sin subir"}`
                  : "Mesa aún no cerrada"}
              </p>
              {m.acta_path && (
                <button className="ext-btn secondary" style={{ padding: "6px 12px", marginTop: 6 }} onClick={() => verActa(m.mesa)}>
                  VER ACTA
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <VoterSheet
          voter={selected}
          token={token}
          close={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const TABS = [
  { key: "fiscales", label: "FISCALES" },
  { key: "movilizadores", label: "MOVILIZADORES" },
  { key: "choferes", label: "CHOFERES" },
  { key: "mapa", label: "MAPA INTERACTIVO" },
] as const;
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
        {tab === "movilizadores" && <RoleRoster token={token} role="movilizador" label="Movilizadores" />}
        {tab === "choferes" && <RoleRoster token={token} role="chofer" label="Choferes" />}
        {tab === "mapa" && <MapView token={token} />}
      </section>
      <ScrollTopButton />
    </main>
  );
}
