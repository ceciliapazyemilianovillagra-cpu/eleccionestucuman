"use client";
import { useEffect, useState } from "react";
import { rpc, Voter } from "./shared";
import { ScrollTopButton } from "./ScrollTopButton";
import { useRealtime } from "./realtime";
import { VoterSheet } from "./VoterSheet";

type Colaborador = {
  padron_id: number;
  dni: string;
  apellido_nombre: string;
  mesa: string | null;
  circuito_nombre: string | null;
  disputed: boolean;
  loaded_by_nombre: string | null;
  loaded_by_email: string | null;
  candidate_nombre: string | null;
};

export function Colaboradores({ token, close }: { token: string; close: () => void }) {
  const [rows, setRows] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Voter | null>(null);
  const [filter, setFilter] = useState<"all" | "unicos" | "disputed">("all");

  async function load(q = "") {
    setLoading(true);
    try {
      const data = await rpc(token, "list_colaboradores", { p_query: q || null });
      setRows(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  useRealtime(["person_roles", "mobilizer_voter_links"], token, () => load(query));

  const total = rows.length;
  const disputed = rows.filter((r) => r.disputed).length;
  const unicos = total - disputed;
  const filteredRows = rows.filter((r) => (filter === "unicos" ? !r.disputed : filter === "disputed" ? r.disputed : true));

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = filteredRows.map((r) => ({
      DNI: r.dni,
      "Apellido y Nombre": r.apellido_nombre,
      Mesa: r.mesa ?? "",
      Circuito: r.circuito_nombre ?? "",
      Estado: r.disputed ? "Reclamado" : "Único",
      "Cargado por": r.loaded_by_nombre ?? r.loaded_by_email ?? "",
      Candidato: r.candidate_nombre ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Votantes");
    XLSX.writeFile(wb, "votantes.xlsx");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.text("Votantes", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [["DNI", "Apellido y Nombre", "Mesa", "Circuito", "Estado", "Cargado por", "Candidato"]],
      body: filteredRows.map((r) => [r.dni, r.apellido_nombre, r.mesa ?? "", r.circuito_nombre ?? "", r.disputed ? "Reclamado" : "Único", r.loaded_by_nombre ?? r.loaded_by_email ?? "", r.candidate_nombre ?? ""]),
      styles: { fontSize: 8 },
    });
    doc.save("votantes.pdf");
  }

  return (
    <main className="padron-page">
      <header className="padron-header">
        <button onClick={close}>←</button>
        <div>
          <small>MÓDULO</small>
          <h1>VOTANTES</h1>
        </div>
        <img src="/icon.svg" alt="Logo" />
      </header>
      <section className="padron-content">
        <div className="stats-grid">
          <button type="button" className="stat-card" style={{ "--stat-accent": "var(--navy)" } as React.CSSProperties} onClick={() => setFilter("all")}>
            <span className="stat-seal"><b>{total}</b></span>
            <p>Cargados</p>
          </button>
          <button type="button" className="stat-card" style={{ "--stat-accent": "var(--green)" } as React.CSSProperties} onClick={() => setFilter("unicos")}>
            <span className="stat-seal"><b>{unicos}</b></span>
            <p>Únicos</p>
          </button>
          <button type="button" className="stat-card" style={{ "--stat-accent": "#a3231e" } as React.CSSProperties} onClick={() => setFilter("disputed")}>
            <span className="stat-seal"><b>{disputed}</b></span>
            <p>Reclamados</p>
          </button>
        </div>
        {filter !== "all" && (
          <p className="ext-note" style={{ margin: "0 0 10px" }}>
            Mostrando solo: {filter === "unicos" ? "únicos" : "reclamados"}.{" "}
            <button type="button" className="ext-btn secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setFilter("all")}>
              QUITAR FILTRO
            </button>
          </p>
        )}
        <form
          className="search-card"
          onSubmit={(e) => {
            e.preventDefault();
            load(query);
          }}
        >
          <label>
            Buscar votante
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="DNI o nombre" autoComplete="off" />
          </label>
          <button disabled={loading}>{loading ? "BUSCANDO…" : "BUSCAR"}</button>
        </form>
        <div className="results-head">
          <b>Resultados</b>
          <span>{filteredRows.length} mostrados</span>
        </div>
        <div className="export-row">
          <button className="ext-btn secondary" type="button" onClick={exportExcel} disabled={!filteredRows.length}>
            EXPORTAR EXCEL
          </button>
          <button className="ext-btn secondary" type="button" onClick={exportPdf} disabled={!filteredRows.length}>
            EXPORTAR PDF
          </button>
        </div>
        {loading && <p className="empty">Buscando…</p>}
        {!loading && !filteredRows.length && <p className="empty">No hay votantes para mostrar.</p>}
        <div className="results">
          {filteredRows.map((r) => (
            <button
              key={r.padron_id}
              className="voter-row compact-row"
              title={`DNI ${r.dni} · Mesa ${r.mesa ?? "-"} · Cargado por ${r.loaded_by_nombre ?? r.loaded_by_email ?? "—"}`}
              onClick={() =>
                setSelected({
                  id: r.padron_id,
                  dni: r.dni,
                  apellido_nombre: r.apellido_nombre,
                  domicilio: null,
                  circuito: r.circuito_nombre || "",
                  circuito_nombre: r.circuito_nombre,
                  mesa: r.mesa || "",
                  orden: null,
                  anio_nacimiento: null,
                })
              }
            >
              <div>
                <b>{r.apellido_nombre}</b>
                {r.candidate_nombre && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>{r.candidate_nombre}</p>}
              </div>
              <span className={`badge sm ${r.disputed ? "danger" : "ok"}`}>{r.disputed ? "Reclamado" : "Único"}</span>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <VoterSheet
          voter={selected}
          token={token}
          close={() => {
            setSelected(null);
            load(query);
          }}
        />
      )}
      <ScrollTopButton />
    </main>
  );
}
